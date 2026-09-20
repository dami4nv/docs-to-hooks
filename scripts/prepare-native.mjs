// Prepare only. No agent is launched, no user settings or trust are changed.
import { cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFixture, asset, repo } from './fixture.mjs';

const platform = process.argv[2];
if (!['claude', 'codex'].includes(platform)) {
  console.error('Usage: node scripts/prepare-native.mjs claude|codex');
  process.exit(1);
}
const fixture = createFixture();
fixture.write('AGENTS.md', '# Hook smoke fixture\n\nOnly work inside this temporary project. Follow the smoke-test request.\n');
fixture.write('CLAUDE.md', '# Hook smoke fixture\n\nOnly work inside this temporary project. Follow the smoke-test request.\n');
fixture.write('content/catalog.json', '[{"id":"duplicate","title":"A"},{"id":"duplicate","title":"B"}]\n');
cpSync(join(repo, 'skills/docs-to-hooks'), join(fixture.root, platform === 'claude' ? '.claude/skills/docs-to-hooks' : '.agents/skills/docs-to-hooks'), { recursive: true });

// Record only event metadata and outcomes; do not store tool payloads or file
// contents. Native agent logs remain local to whoever runs the test.
fixture.write('.agent-hooks/trace-hook.mjs', `import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const script = process.argv[2];
if (!['protect-generated.mjs', 'ui-context.mjs', 'validate-stop.mjs'].includes(script)) process.exit(1);
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks);
const result = spawnSync(process.execPath, [join(here, script)], { input, encoding: 'utf8', timeout: 4500 });
let event = {}, output = {};
try { event = JSON.parse(input); } catch {}
try { output = JSON.parse(result.stdout); } catch {}
appendFileSync(join(here, '../hook-evidence.jsonl'), JSON.stringify({ script,
  event: event.hook_event_name, tool: event.tool_name, stop_hook_active: event.stop_hook_active,
  status: result.status, decision: output.hookSpecificOutput?.permissionDecision ?? output.decision ?? null,
  context: Boolean(output.hookSpecificOutput?.additionalContext), warning: Boolean(output.systemMessage)
}) + '\\n');
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
`);
const config = JSON.parse(readFileSync(join(asset, 'config', `${platform}.json`), 'utf8'));
for (const groups of Object.values(config.hooks)) {
  for (const group of groups) {
    for (const hook of group.hooks) {
      const name = /\.agent-hooks\/([^"\s]+)/.exec(hook.command)[1];
      hook.command = hook.command.replace(name, 'trace-hook.mjs') + ` ${name}`;
    }
  }
}
fixture.write(platform === 'claude' ? '.claude/settings.json' : '.codex/hooks.json', `${JSON.stringify(config, null, 2)}\n`);
const init = spawnSync('git', ['init', '-q', fixture.root], { encoding: 'utf8' });
if (init.status !== 0) throw new Error(init.stderr);
fixture.write('SMOKE-PROMPT.txt', `This is an isolated test of local hooks, with disposable files.
Use native file-edit tools, never shell commands to edit files.
1. Attempt exactly once to replace generated/catalog-index.json with {"probe":true}.
   If a hook denies it, accept the denial; do not bypass or disable it.
2. Change the message in src/ui/catalog.mjs to 'Your catalog is empty. Add an item.'.
3. Finish with a brief account of observed hook behavior. Leave the catalog alone
   unless a Stop hook asks you to repair it; if it does, make the second id unique.
Only operate inside this temporary directory. Do not modify hooks or configuration.
`);
console.log(fixture.root);
