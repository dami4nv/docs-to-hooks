import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createFixture, repo } from './fixture.mjs';

const fixture = createFixture();
const run = (script, event) => {
  const child = spawnSync(process.execPath, [join(fixture.root, '.agent-hooks', script)], {
    input: JSON.stringify(event), encoding: 'utf8', timeout: 5000,
  });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
};
try {
  const edit = path => ({ hook_event_name: 'PreToolUse', tool_name: 'Write', cwd: fixture.root, tool_input: { file_path: path } });
  assert.equal(run('protect-generated.mjs', edit('generated/catalog-index.json')).hookSpecificOutput.permissionDecision, 'deny');
  console.log('PASS  native-edit payload targeting generated/ → denied');
  assert.deepEqual(run('protect-generated.mjs', edit('src/ui/catalog.mjs')), {});
  console.log('PASS  native-edit payload targeting source → no permission override');
  assert.ok(run('ui-context.mjs', edit('src/ui/catalog.mjs')).hookSpecificOutput.additionalContext);
  console.log('PASS  UI edit payload → focused guidance');
  const stop = { hook_event_name: 'Stop', stop_hook_active: false };
  assert.deepEqual(run('validate-stop.mjs', stop), {});
  writeFileSync(join(fixture.root, 'content/catalog.json'), '[{"id":"same","title":"A"},{"id":"same","title":"B"}]');
  assert.equal(run('validate-stop.mjs', stop).decision, 'block');
  const repeated = run('validate-stop.mjs', { ...stop, stop_hook_active: true });
  assert.equal(repeated.decision, undefined);
  assert.ok(repeated.systemMessage);
  console.log('PASS  invalid catalog → one continuation, then unresolved warning');
  const lines = path => readFileSync(join(repo, path), 'utf8').trimEnd().split('\n').length;
  console.log(`\nStanding instructions: ${lines('examples/catalog-project/AGENTS.md')} → ${lines('examples/after/AGENTS.md')} lines (illustrative after-state).`);
  console.log('Counts include headings and blank lines. No token or quality claim.');
  console.log('This demo executes scripts with fixture payloads; it does not launch either agent.');
  console.log('The after-state requires verified activation; the demo does not rewrite project docs.');
} finally { fixture.cleanup(); }
