import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { repo, asset } from './fixture.mjs';

function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules'].includes(entry.name)) return [];
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const skillRoot = join(repo, 'skills/docs-to-hooks');
const skill = readFileSync(join(skillRoot, 'SKILL.md'), 'utf8');
const frontmatter = /^---\n([\s\S]+?)\n---\n/.exec(skill)?.[1];
assert.ok(frontmatter, 'Missing skill frontmatter');
assert.match(frontmatter, /^name: docs-to-hooks$/m);
assert.match(frontmatter, /^description: .{20,}$/m);
assert.ok(skill.length < 12000, 'Keep the entrypoint small and move details into references');
assert.match(readFileSync(join(skillRoot, 'agents/openai.yaml'), 'utf8'), /\$docs-to-hooks/);

for (const path of files(repo)) {
  if (path.endsWith('.mjs')) {
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  if (!path.endsWith('.md')) continue;
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
    const link = match[1];
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const target = resolve(dirname(path), decodeURIComponent(link.split('#')[0]));
    assert.ok(existsSync(target), `Broken link in ${relative(repo, path)}: ${link}`);
    if (path.startsWith(skillRoot)) {
      assert.ok(target === skillRoot || target.startsWith(`${skillRoot}/`), 'Installed skill must be self-contained');
    }
  }
}

for (const platform of ['claude', 'codex']) {
  const config = JSON.parse(readFileSync(join(asset, 'config', `${platform}.json`), 'utf8'));
  assert.deepEqual(Object.keys(config), ['hooks']);
  for (const groups of Object.values(config.hooks)) {
    for (const group of groups) {
      if (group.matcher) new RegExp(group.matcher);
      for (const hook of group.hooks) {
        assert.equal(hook.type, 'command');
        assert.ok(hook.timeout > 0 && hook.timeout <= 5);
        const script = /\.agent-hooks\/([^"\s]+\.mjs)/.exec(hook.command)?.[1];
        assert.ok(script && existsSync(join(asset, 'hooks', script)), 'Config must reference a shipped hook');
      }
    }
  }
}

const lines = path => readFileSync(join(repo, path), 'utf8').trimEnd().split('\n').length;
const readme = readFileSync(join(repo, 'README.md'), 'utf8');
assert.ok(readme.includes(`[${lines('examples/catalog-project/AGENTS.md')} lines of standing instructions]`));
assert.ok(readme.includes(`[${lines('examples/after/AGENTS.md')}-line after-state]`));
console.log('PASS  skill metadata, self-contained local links, script syntax, configuration assets, and measured README counts');
