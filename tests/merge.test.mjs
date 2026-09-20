import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mergeHookConfig } from '../skills/docs-to-hooks/scripts/merge-hook-config.mjs';
import { createFixture, repo, asset } from '../scripts/fixture.mjs';

for (const platform of ['claude', 'codex']) {
  test(`${platform}: preserves unrelated settings and handlers, reruns are idempotent`, () => {
    const existing = {
      permissions: { deny: ['Bash(nope)'] }, custom: { nested: true },
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo existing', timeout: 1 }] }] },
    };
    const original = structuredClone(existing);
    const fragment = JSON.parse(readFileSync(join(asset, 'config', `${platform}.json`), 'utf8'));
    const result = mergeHookConfig(existing, fragment);
    assert.deepEqual(existing, original);
    assert.deepEqual(result.permissions, original.permissions);
    assert.deepEqual(result.custom, original.custom);
    assert.deepEqual(result.hooks.Stop[0].hooks[0], original.hooks.Stop[0].hooks[0]);
    assert.equal(result.hooks.Stop[0].hooks.length, 2);
    assert.deepEqual(mergeHookConfig(result, fragment), result);
  });
}

test('different command definitions or matchers collide instead of overwriting', () => {
  const existing = { hooks: { PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'node check.mjs', timeout: 5 }] }] } };
  for (const change of [{ matcher: 'Edit' }, { timeout: 10 }]) {
    const fragment = structuredClone(existing);
    if (change.matcher) fragment.hooks.PreToolUse[0].matcher = change.matcher;
    else fragment.hooks.PreToolUse[0].hooks[0].timeout = change.timeout;
    assert.throws(() => mergeHookConfig(existing, fragment), /Conflicting/);
  }
});

test('key order does not create duplicate definitions', () => {
  const a = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'check', timeout: 5 }] }] } };
  const b = { hooks: { Stop: [{ hooks: [{ timeout: 5, command: 'check', type: 'command' }] }] } };
  assert.deepEqual(mergeHookConfig(a, b), a);
});

test('rejects malformed configuration and fragments with unrelated settings', () => {
  for (const value of [null, [], { hooks: [] }, { hooks: { Stop: {} } }, { hooks: { Stop: [{}] } }]) {
    assert.throws(() => mergeHookConfig(value, { hooks: {} }));
    assert.throws(() => mergeHookConfig({}, value));
  }
  assert.throws(() => mergeHookConfig({}, { permissions: {} }), /only contain hooks/);
});

test('command-line helper prints a merge without writing either source', t => {
  const fixture = createFixture();
  t.after(fixture.cleanup);
  const original = '{"permissions":{"deny":[]}}\n';
  const existing = join(fixture.root, 'existing.json');
  writeFileSync(existing, original);
  const fragment = join(asset, 'config/claude.json');
  const before = readFileSync(fragment, 'utf8');
  const result = spawnSync(process.execPath, [join(repo, 'skills/docs-to-hooks/scripts/merge-hook-config.mjs'), existing, fragment], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).hooks.PreToolUse);
  assert.equal(readFileSync(existing, 'utf8'), original);
  assert.equal(readFileSync(fragment, 'utf8'), before);
});
