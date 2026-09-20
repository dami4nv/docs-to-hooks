---
name: review-duplication
description: Review proposed code for duplicate responsibilities and install or adapt an OpenCode-backed CI review gate with explicit maintainer dispositions. Use for abstraction and reuse reviews, not generic style checks or automatic refactoring.
---

# Review duplication

Find repeated responsibilities that should have one owner. Do not turn similar
syntax into a requirement to build an abstraction.

## Inspect before adding machinery

Read the selected project's guidance, component/API owners, existing review jobs,
required checks and exception process. Reuse an existing reviewer, snapshot
runner or disposition mechanism where suitable. Do not create a second general
PR-review service. Multiple repositories do not imply a monorepo migration.

For a review request, assess the specified immutable change without editing code.
For an installation request, implement a bounded gate in a branch, preserve
existing settings, and verify it before proposing activation. Merely installing
this skill creates no hook, workflow, required check or model subscription.

## Assess responsibilities

Use the [review prompt](assets/review-prompt.md), adapted to actual project
boundaries. Search for existing consumers and owners before proposing extraction.
Every finding needs both source locations, the repeated responsibility, the
practical cost of separate ownership, and a bounded fix or reason to retain it.

Block a concrete second implementation of an established shared responsibility.
Leave uncertain similarity or a speculative future consumer advisory. Preserve
distinct authorization, lifecycle, transaction and platform boundaries. Also flag
a proposed generic layer that has no demonstrated consumer or forces unrelated
responsibilities together. Do not auto-refactor in the review job.

## Install and qualify a gate

Read [CI integration](references/ci-integration.md) before wiring OpenCode,
credentials, dispositions or required checks. It defines the trust boundary and
the bundled [report contract](references/report-contract.md).

The dependency-free [evaluator](scripts/evaluate-review.mjs) checks exact review
scope and unresolved findings. Reuse it where the host's existing gate does not
already provide equivalent enforcement. It does not run OpenCode, authenticate
reviewers, publish GitHub checks or change branch protection.

Test clean, blocking, advisory, failed, incomplete and stale reviews; forged,
unauthorized and stale exceptions; and deliberate separate responsibilities.
Verify the actual pinned OpenCode version and configured model against fictional
cases, recording its misses and false positives separately from evaluator tests.
Do not silently translate an unavailable review into a pass.

An installation is complete only when the real PR check runs on the current head,
an unresolved fixture blocks merging, an authorized disposition clears only its
finding, and a new commit invalidates that disposition. Otherwise report what is
implemented and what remains unqualified. Keep runtime versions, activation
evidence and project-specific policy in the target project's existing records.
