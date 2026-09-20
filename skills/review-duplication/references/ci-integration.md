# Wire the review into existing CI

OpenCode supports pull-request review events and configurable tool permissions:
[GitHub integration](https://opencode.ai/docs/github/),
[permissions](https://opencode.ai/docs/permissions/), and
[CLI](https://opencode.ai/docs/cli/). Verify the pinned version's actual behavior;
the upstream examples are not an already-qualified blocking gate.

## Trust and scope

- Use the target's existing review runner and publisher when possible. Keep the
  model focused on duplication; ordinary CI and other reviewers keep their jobs.
- Obtain current repository, PR number, head and base SHAs from authenticated
  GitHub metadata. Pin any reference repository to a commit too. Recheck those
  values before publishing; a merge-base or dependency change invalidates scope.
- Run trusted gate code and policy from the protected base or a pinned external
  revision. PR code cannot change the required check, allowlist or evaluator for
  its own run. Review control-plane changes separately.
- Give the model disposable committed source snapshots, with no `.git`, `.env`,
  `.dev.vars` or application credentials. Reject unexpected symlinks and scanned
  secrets. Use fresh isolated data/config/cache/state directories; never point it
  at a developer checkout or normal agent stores. `--dir` is not isolation.
- Treat PR-controlled OpenCode configs, plugins, skills and agent instructions as
  source data, not runtime configuration. Verify config-loading behavior and use
  a sandbox with only snapshot reads and provider connectivity. Deny edits,
  shell, network tools, MCP and delegation; a permissions prompt is not a sandbox.
  Keep any provider credential outside source. Disable public session sharing.
- Do not execute untrusted PR scripts with secrets, including via
  `pull_request_target`. Do not copy developer OAuth sessions into CI. Use an
  approved dedicated provider credential, bounded cost and timeout. Installing
  this skill does not provision those credentials or choose a provider/model.

## Separate analysis from the merge decision

1. The trusted runner supplies the scope and output contract, runs the reviewer,
   and records whether the review actually completed. Errors, partial output,
   missing context and malformed JSON block the check; they are not “no findings.”
2. Validate citations against the snapshots. Attach the validated report and scope
   to the review evidence. Preserve the model's findings; do not let a second
   model silently dismiss them.
3. Publish findings through an existing trusted publisher. Fetch authenticated,
   current maintainer dispositions and pass only verified records to the
   [evaluator](../scripts/evaluate-review.mjs). Neither the model nor a PR file may
   supply the allowlist, actor identity, completion flag or acceptance.
4. A disposition states the finding, report digest and justification. A comment
   saying “reviewed” or resolving a thread is insufficient. An edited/deleted
   acceptance must be re-evaluated; rerun on head/base/source changes. Guard
   against a stale run overwriting a newer head's status.
5. Register the verified job/check identity as a required check in the repository
   ruleset, preserving existing requirements. The model cannot publish success
   itself. Check provenance, freshness and disposition validation belong in code.

A GitHub `User` identity does **not** prove a person clicked: an agent can use that
person's token. For a human-only exception policy, use a separately protected
approval path whose credentials are unavailable to the implementation agent.
Without it, describe enforcement honestly as approved-account acceptance.

## Qualification and delivery

Exercise a fictional PR with: no duplication; a duplicate with a canonical owner;
legitimate platform adapters; a speculative generic wrapper; model timeout;
truncated/malformed output; forged acceptance; authorized acceptance; new commit;
changed reference snapshot; and deleted/edited disposition. Confirm live merge
blocking and re-evaluation rather than relying on job names or local fixtures.

Keep a compact record of pinned tooling/model, repository scope, evidence, false
positives, accepted exceptions and remaining limits. A model review can miss
duplication; deterministic import/contract rules should enforce settled boundaries
where practical. Do not label the check a proof of architectural correctness.

This package supplies review guidance and the tested evaluator. It intentionally
does not ship an auto-enabled workflow: installation must fit the target's existing
review and identity infrastructure. Adding a dormant skill is not CI activation.
