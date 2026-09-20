import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFixture, asset } from '../scripts/fixture.mjs';

function setup(t) {
  const fixture = createFixture();
  t.after(fixture.cleanup);
  const { root } = fixture;
  const run = (script, event) => {
    const result = spawnSync(process.execPath, [join(root, '.agent-hooks', script)], {
      input: typeof event === 'string' ? event : JSON.stringify(event),
      encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024,
    });
    assert.equal(result.error, undefined);
    return { ...result, output: result.stdout ? JSON.parse(result.stdout) : undefined };
  };
  const edit = (path, tool = 'Write', cwd = root) => ({ hook_event_name: 'PreToolUse', cwd, tool_name: tool, tool_input: { file_path: path } });
  const patch = command => ({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'apply_patch', tool_input: { command } });
  return { ...fixture, run, edit, patch };
}

for (const tool of ['Write', 'Edit']) {
  test(`${tool}: denies generated paths but permits source and prefix lookalikes`, t => {
    const { root, run, edit } = setup(t);
    for (const path of ['generated/catalog-index.json', 'generated/new file.json', join(root, 'generated/catalog-index.json'), 'src/../generated/new.json']) {
      const result = run('protect-generated.mjs', edit(path, tool));
      assert.equal(result.status, 0);
      assert.equal(result.output.hookSpecificOutput.permissionDecision, 'deny');
    }
    for (const path of ['src/ui/catalog.mjs', 'generated-other/file.json', 'README.md']) {
      assert.deepEqual(run('protect-generated.mjs', edit(path, tool)).output, {});
    }
    assert.equal(run('protect-generated.mjs', edit('../generated/new.json', tool, join(root, 'src'))).output.hookSpecificOutput.permissionDecision, 'deny');
  });
}

for (const header of ['Add File', 'Update File', 'Delete File', 'Move to']) {
  test(`apply_patch: protects ${header} paths`, t => {
    const { run, patch } = setup(t);
    const body = header === 'Move to'
      ? '*** Update File: src/ui/catalog.mjs\n*** Move to: generated/moved.mjs\n@@\n-old\n+new'
      : `*** ${header}: generated/new file.json\n${header === 'Delete File' ? '' : '+{}\n'}`;
    const result = run('protect-generated.mjs', patch(`*** Begin Patch\n${body}\n*** End Patch`));
    assert.equal(result.output.hookSpecificOutput.permissionDecision, 'deny');
  });
}

test('patch handles multiple files, CRLF, safe patches, and header-like added content', t => {
  const { run, patch } = setup(t);
  const safe = '*** Begin Patch\n*** Add File: src/example.txt\n+*** Update File: generated/fake.json\n*** End Patch\n';
  assert.deepEqual(run('protect-generated.mjs', patch(safe)).output, {});
  const multi = '*** Begin Patch\r\n*** Add File: src/ok.txt\r\n+ok\r\n*** Delete File: generated/catalog-index.json\r\n*** End Patch\r\n';
  assert.equal(run('protect-generated.mjs', patch(multi)).output.hookSpecificOutput.permissionDecision, 'deny');
});

test('symlinked existing and new files are resolved; broken symlinks are explicit failures', t => {
  const { root, run, edit } = setup(t);
  symlinkSync(join(root, 'generated'), join(root, 'alias'));
  for (const path of ['alias/catalog-index.json', 'alias/new.json']) {
    assert.equal(run('protect-generated.mjs', edit(path)).output.hookSpecificOutput.permissionDecision, 'deny');
  }
  symlinkSync(join(root, 'does-not-exist'), join(root, 'broken'));
  assert.equal(run('protect-generated.mjs', edit('broken/file.json')).status, 2);
});

test('guard does not pretend to cover shell or arbitrary tools', t => {
  const { root, run } = setup(t);
  for (const tool_name of ['Bash', 'exec_command', 'mcp__files__write']) {
    assert.deepEqual(run('protect-generated.mjs', { hook_event_name: 'PreToolUse', cwd: root, tool_name, tool_input: { command: 'write generated/file' } }).output, {});
  }
});

test('malformed supported input blocks without echoing sensitive payloads', t => {
  const { root, run, edit, patch } = setup(t);
  const invalid = ['secret-value{', 'null', '[]', '{}', 'x'.repeat(129 * 1024),
    { ...edit('x'), cwd: 'relative' }, edit(''), edit(null), edit('a\0b'),
    { ...edit('x'), tool_input: [] }, { ...edit('x'), hook_event_name: 'PostToolUse' },
    patch('not a patch'), patch('*** Begin Patch\n*** End Patch'),
    patch('*** Begin Patch\n*** Unknown: generated/a\n*** End Patch'),
    { hook_event_name: 'PreToolUse', tool_name: 'apply_patch', cwd: root, tool_input: {} }];
  for (const input of invalid) {
    const result = run('protect-generated.mjs', input);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes('could not be checked'));
    assert.ok(!result.stderr.includes('secret-value'));
  }
});

test('guidance is relevant and advisory for Claude and Codex edits', t => {
  const { run, edit, patch } = setup(t);
  for (const event of [edit('src/ui/catalog.mjs'), patch('*** Begin Patch\n*** Update File: src/ui/catalog.mjs\n@@\n-a\n+b\n*** End Patch')]) {
    const { output, status } = run('ui-context.mjs', event);
    assert.equal(status, 0);
    assert.ok(output.hookSpecificOutput.additionalContext.includes('docs/ui.md'));
    assert.equal(output.hookSpecificOutput.permissionDecision, undefined);
  }
  for (const path of ['src/ui-other/a.mjs', 'content/catalog.json']) {
    assert.deepEqual(run('ui-context.mjs', edit(path)).output, {});
  }
  const malformed = run('ui-context.mjs', 'bad json');
  assert.equal(malformed.status, 0);
  assert.ok(malformed.output.systemMessage);
});

test('Stop succeeds quietly, requests one repair, and does not hide repeated failure', t => {
  const { root, run } = setup(t);
  const event = { hook_event_name: 'Stop', stop_hook_active: false };
  assert.deepEqual(run('validate-stop.mjs', event).output, {});
  writeFileSync(join(root, 'content/catalog.json'), '[{"id":"a","title":"A"},{"id":"a","title":"B"}]');
  const first = run('validate-stop.mjs', event).output;
  assert.equal(first.decision, 'block');
  assert.ok(first.reason.includes('unique'));
  const second = run('validate-stop.mjs', { ...event, stop_hook_active: true }).output;
  assert.equal(second.decision, undefined);
  assert.ok(second.systemMessage.includes('still fails'));
  writeFileSync(join(root, 'content/catalog.json'), '[]');
  assert.deepEqual(run('validate-stop.mjs', { ...event, stop_hook_active: true }).output, {});
});

for (const contents of ['not json', '{}', '[null]', '[{"id":" ","title":"ok"}]', '[{"id":"ok","title":1}]', ' '.repeat(65 * 1024)]) {
  test(`Stop reports invalid catalog (${contents.length} bytes) with bounded feedback`, t => {
    const { root, run } = setup(t);
    writeFileSync(join(root, 'content/catalog.json'), contents);
    const { output } = run('validate-stop.mjs', { hook_event_name: 'Stop', stop_hook_active: false });
    assert.equal(output.decision, 'block');
    assert.ok(JSON.stringify(output).length < 600);
  });
}

test('Stop requires a boolean loop flag and never reads through a catalog symlink', t => {
  const { root, run } = setup(t);
  for (const flag of [undefined, 'false', 0]) {
    const output = run('validate-stop.mjs', { hook_event_name: 'Stop', stop_hook_active: flag }).output;
    assert.equal(output.decision, undefined);
    assert.ok(output.systemMessage);
  }
  const other = join(root, 'secret.json');
  writeFileSync(other, 'private-value');
  // Replace the fixture file, never any user file.
  unlinkSync(join(root, 'content/catalog.json'));
  symlinkSync(other, join(root, 'content/catalog.json'));
  const output = run('validate-stop.mjs', { hook_event_name: 'Stop', stop_hook_active: false }).output;
  assert.equal(output.decision, 'block');
  assert.ok(!JSON.stringify(output).includes('private-value'));
});

for (const platform of ['claude', 'codex']) {
  test(`${platform} config commands resolve from nested directories with spaces`, t => {
    const { root, edit } = setup(t);
    const git = spawnSync('git', ['init', '-q', root], { encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
    const config = JSON.parse(readFileSync(join(asset, 'config', `${platform}.json`), 'utf8'));
    const cwd = join(root, 'src/ui');
    const input = platform === 'claude' ? edit(join(root, 'generated/new file.json')) : {
      hook_event_name: 'PreToolUse', cwd, tool_name: 'apply_patch',
      tool_input: { command: '*** Begin Patch\n*** Add File: ../../generated/new file.json\n+{}\n*** End Patch' },
    };
    const command = config.hooks.PreToolUse[0].hooks[0].command;
    const result = spawnSync('/bin/sh', ['-c', command], {
      cwd, input: JSON.stringify(input), encoding: 'utf8', timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
    // These tests execute configured commands, not an agent runtime.
  });
}

test('Codex command uses the active linked worktree instead of the original checkout', t => {
  const { root } = setup(t);
  const git = (...args) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture');
  const worktree = `${root} linked worktree`;
  git('worktree', 'add', '--detach', '-q', worktree);
  t.after(() => rmSync(worktree, { recursive: true, force: true }));
  writeFileSync(join(worktree, 'content/catalog.json'), 'invalid json');
  const config = JSON.parse(readFileSync(join(asset, 'config/codex.json'), 'utf8'));
  const result = spawnSync('/bin/sh', ['-c', config.hooks.Stop[0].hooks[0].command], {
    cwd: join(worktree, 'src/ui'), encoding: 'utf8', timeout: 5000,
    input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).decision, 'block');
  assert.doesNotThrow(() => JSON.parse(readFileSync(join(root, 'content/catalog.json'), 'utf8')));
});
