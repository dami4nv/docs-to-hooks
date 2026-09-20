import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sha = /^[a-f0-9]{40}$/;
const repo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const maxBytes = 1024 * 1024;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function shape(value, fields) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected an object');
  requireValue(Object.keys(value).sort().join(',') === [...fields].sort().join(','), 'Missing or unexpected fields');
}

function text(value, max = 4000) {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'Invalid text field');
}

function target(value) {
  shape(value, ['repository', 'pullRequest', 'baseSha', 'headSha']);
  requireValue(typeof value.repository === 'string' && repo.test(value.repository), 'Invalid repository');
  requireValue(Number.isSafeInteger(value.pullRequest) && value.pullRequest > 0, 'Invalid PR number');
  requireValue(typeof value.baseSha === 'string' && sha.test(value.baseSha), 'Invalid base SHA');
  requireValue(typeof value.headSha === 'string' && sha.test(value.headSha), 'Invalid head SHA');
}

function sources(value, current) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'Invalid source revisions');
  const entries = Object.entries(value);
  requireValue(entries.length > 0 && entries.length <= 20, 'Invalid source count');
  for (const [repository, revision] of entries) {
    requireValue(repo.test(repository) && typeof revision === 'string' && sha.test(revision), 'Invalid source revision');
  }
  requireValue(value[current.repository] === current.headSha, 'Target source does not match head');
}

function location(value, revisions) {
  shape(value, ['repository', 'path', 'line']);
  requireValue(Object.hasOwn(revisions, value.repository), 'Location outside reviewed repositories');
  text(value.path, 500);
  requireValue(!/[\\\x00-\x1f\x7f]/.test(value.path), 'Invalid source path');
  requireValue(value.path.split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'Source path must be relative');
  requireValue(!/^[A-Za-z]:/.test(value.path), 'Invalid source path');
  requireValue(Number.isSafeInteger(value.line) && value.line > 0, 'Invalid source line');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function evaluateReview(input) {
  try {
    shape(input, ['context', 'report', 'dispositions']);
    const { context, report, dispositions } = input;
    shape(context, ['target', 'sources', 'reviewCompleted', 'approvers']);
    target(context.target);
    sources(context.sources, context.target);
    requireValue(context.reviewCompleted === true, 'Review did not complete');
    requireValue(Array.isArray(context.approvers) && context.approvers.length <= 100, 'Invalid approver list');
    context.approvers.forEach(login => text(login, 100));

    shape(report, ['schemaVersion', 'target', 'sources', 'findings']);
    requireValue(report.schemaVersion === 1, 'Unsupported report version');
    target(report.target);
    sources(report.sources, report.target);
    requireValue(canonical(report.target) === canonical(context.target), 'Review target is stale or unrelated');
    requireValue(canonical(report.sources) === canonical(context.sources), 'Reference sources changed');
    requireValue(Array.isArray(report.findings) && report.findings.length <= 200, 'Invalid findings');
    const ids = new Set();
    for (const finding of report.findings) {
      shape(finding, ['id', 'severity', 'title', 'rationale', 'recommendation', 'proposed', 'existing']);
      text(finding.id, 100);
      requireValue(/^[a-z0-9][a-z0-9-]*$/.test(finding.id) && !ids.has(finding.id), 'Invalid or repeated finding ID');
      ids.add(finding.id);
      requireValue(['blocking', 'advisory'].includes(finding.severity), 'Invalid finding severity');
      text(finding.title, 300);
      text(finding.rationale);
      text(finding.recommendation);
      location(finding.proposed, context.sources);
      location(finding.existing, context.sources);
      requireValue(finding.proposed.repository === context.target.repository, 'Proposed location must be in target repository');
    }

    const reportDigest = createHash('sha256').update(canonical(report)).digest('hex');
    requireValue(Array.isArray(dispositions) && dispositions.length <= 200, 'Invalid dispositions');
    const accepted = new Set();
    const approvers = new Set(context.approvers.map(login => login.toLowerCase()));
    for (const disposition of dispositions) {
      shape(disposition, ['findingId', 'reportDigest', 'action', 'reason', 'actor']);
      requireValue(ids.has(disposition.findingId) && !accepted.has(disposition.findingId), 'Unknown or repeated disposition');
      requireValue(disposition.reportDigest === reportDigest, 'Disposition is stale');
      requireValue(disposition.action === 'accept', 'Unsupported disposition action');
      text(disposition.reason);
      shape(disposition.actor, ['login', 'type']);
      text(disposition.actor.login, 100);
      requireValue(disposition.actor.type === 'User' && approvers.has(disposition.actor.login.toLowerCase()), 'Unauthorized disposition actor');
      accepted.add(disposition.findingId);
    }

    const unresolved = report.findings.filter(finding => finding.severity === 'blocking' && !accepted.has(finding.id)).map(finding => finding.id);
    return {
      status: unresolved.length ? 'blocked' : 'passed',
      reportDigest,
      unresolved,
      accepted: [...accepted],
      advisory: report.findings.filter(finding => finding.severity === 'advisory').map(finding => finding.id),
    };
  } catch (error) {
    return { status: 'blocked', error: error.message };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let result;
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      requireValue(bytes <= maxBytes, 'Gate input exceeds 1 MB');
      chunks.push(chunk);
    }
    result = evaluateReview(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    result = { status: 'blocked', error: 'Invalid, unreadable or oversized gate input' };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === 'passed' ? 0 : 1;
}
