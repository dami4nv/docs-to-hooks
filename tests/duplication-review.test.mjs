import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evaluateReview } from '../skills/review-duplication/scripts/evaluate-review.mjs';

const script = fileURLToPath(new URL('../skills/review-duplication/scripts/evaluate-review.mjs', import.meta.url));

function fixture() {
  const target = { repository: 'example/product', pullRequest: 12, baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40) };
  const sources = { 'example/product': target.headSha, 'example/service': 'c'.repeat(40) };
  return {
    context: { target, sources, reviewCompleted: true, approvers: ['maintainer'] },
    report: { schemaVersion: 1, target: { ...target }, sources: { ...sources }, findings: [] },
    dispositions: [],
  };
}

function duplicate(input) {
  input.report.findings.push({
    id: 'duplicate-total', severity: 'blocking', title: 'Repeated total calculation',
    rationale: 'A second rounding rule can diverge from the authoritative total.',
    recommendation: 'Consume the existing calculation result.',
    proposed: { repository: 'example/product', path: 'src/total.ts', line: 2 },
    existing: { repository: 'example/service', path: 'src/money.ts', line: 8 },
  });
  return input;
}

function accept(input) {
  input.dispositions.push({
    findingId: 'duplicate-total', reportDigest: evaluateReview(input).reportDigest,
    action: 'accept', reason: 'Independent presentation estimate; the server owns the final total.',
    actor: { login: 'maintainer', type: 'User' },
  });
  return input;
}

test('a completed clean review passes; supported duplication blocks', () => {
  assert.equal(evaluateReview(fixture()).status, 'passed');
  const result = evaluateReview(duplicate(fixture()));
  assert.equal(result.status, 'blocked');
  assert.deepEqual(result.unresolved, ['duplicate-total']);
});

test('uncertain similarity remains visible without forcing an abstraction', () => {
  const input = duplicate(fixture());
  input.report.findings[0].severity = 'advisory';
  const result = evaluateReview(input);
  assert.equal(result.status, 'passed');
  assert.deepEqual(result.advisory, ['duplicate-total']);
});

test('authorized justified acceptance clears only its finding', () => {
  const input = accept(duplicate(fixture()));
  assert.equal(evaluateReview(input).status, 'passed');
  input.report.findings.push({ ...input.report.findings[0], id: 'another-owner' });
  input.dispositions[0].reportDigest = evaluateReview({ ...input, dispositions: [] }).reportDigest;
  assert.deepEqual(evaluateReview(input).unresolved, ['another-owner']);
});

test('base/head, PR, repository and reference revisions are all bound', () => {
  for (const field of ['baseSha', 'headSha', 'pullRequest', 'repository']) {
    const input = fixture();
    input.context.target[field] = field === 'pullRequest' ? 13 : field === 'repository' ? 'other/repo' : 'd'.repeat(40);
    assert.equal(evaluateReview(input).status, 'blocked', field);
  }
  const input = fixture();
  input.context.sources['example/service'] = 'd'.repeat(40);
  assert.equal(evaluateReview(input).status, 'blocked');
});

test('new commits and changed finding content invalidate acceptance', () => {
  const input = accept(duplicate(fixture()));
  input.report.target.headSha = input.context.target.headSha = 'd'.repeat(40);
  input.report.sources['example/product'] = input.context.sources['example/product'] = 'd'.repeat(40);
  assert.equal(evaluateReview(input).status, 'blocked');
  const changed = accept(duplicate(fixture()));
  changed.report.findings[0].rationale = 'Different responsibility with a different impact.';
  assert.equal(evaluateReview(changed).status, 'blocked');
});

test('report digests are independent of JSON object key order', () => {
  const input = duplicate(fixture());
  const original = evaluateReview(input).reportDigest;
  input.report.target = Object.fromEntries(Object.entries(input.report.target).reverse());
  input.report.sources = Object.fromEntries(Object.entries(input.report.sources).reverse());
  assert.equal(evaluateReview(input).reportDigest, original);
});

test('failed and malformed reviews never become clean passes', () => {
  for (const mutate of [
    input => { input.context.reviewCompleted = false; },
    input => { delete input.report.findings; },
    input => { input.report.findings = null; },
    input => { input.report.schemaVersion = 2; },
    input => { input.report.error = 'provider unavailable'; },
    input => { input.report.findings = [{ severity: 'advisory' }]; },
  ]) {
    const input = fixture();
    mutate(input);
    assert.equal(evaluateReview(input).status, 'blocked');
  }
  assert.equal(evaluateReview(null).status, 'blocked');
});

test('agent claims, stale exceptions, bots and unauthorized acceptances block', () => {
  for (const mutate of [
    input => { input.dispositions[0].actor.type = 'Bot'; },
    input => { input.dispositions[0].actor.login = 'implementer'; },
    input => { input.dispositions[0].reason = ' '; },
    input => { input.dispositions[0].reportDigest = 'e'.repeat(64); },
    input => { input.dispositions[0].action = 'fixed'; },
    input => { input.dispositions[0].findingId = 'unknown'; },
    input => { input.dispositions.push({ ...input.dispositions[0] }); },
    input => { input.context.approvers = []; },
  ]) {
    const input = accept(duplicate(fixture()));
    mutate(input);
    assert.equal(evaluateReview(input).status, 'blocked');
  }
});

test('evidence locations cannot escape pinned source repositories', () => {
  for (const path of ['/etc/passwd', '../private', 'src/../private', 'C:/private', 'src\\private', 'src/\u0000secret']) {
    const input = duplicate(fixture());
    input.report.findings[0].existing.path = path;
    assert.equal(evaluateReview(input).status, 'blocked', path);
  }
  const input = duplicate(fixture());
  input.report.findings[0].existing.repository = 'unknown/private';
  assert.equal(evaluateReview(input).status, 'blocked');
});

test('CLI passes clean input and fails closed on blocking, malformed and oversized input', () => {
  for (const [input, status] of [
    [JSON.stringify(fixture()), 0],
    [JSON.stringify(duplicate(fixture())), 1],
    ['not JSON', 1],
    ['x'.repeat(1024 * 1024 + 1), 1],
  ]) {
    const result = spawnSync(process.execPath, [script], { input, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, status, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, status ? 'blocked' : 'passed');
    assert.equal(result.stderr, '');
  }
});
