# Verification

Script tests and native activation are different claims. Installing this skill
does not activate hooks in any project.

## Automated checks

`npm test` exercises both agents' payload shapes, allowed and denied paths, move
destinations, symlinks, malformed and oversized input, advisory failures, catalog
validation, Stop loop prevention, configuration preservation, and merge
idempotency. Example shell-form commands are executed from nested directories
whose paths contain spaces. These are script and configuration tests.

`npm run check` validates the skill's small frontmatter subset, self-contained
local links, JavaScript syntax, configuration assets, and README line counts.
`npm run demo` reproduces the fictional walkthrough without launching an agent.
CI runs these commands on Node.js 22 and 24 on macOS and Linux.

## Reproduce a native smoke test

```sh
node scripts/prepare-native.mjs claude
# or: node scripts/prepare-native.mjs codex
```

This prints a new temporary fixture directory. It includes hooks, the installed
skill, an invalid catalog, and `SMOKE-PROMPT.txt`. No global configuration or
trust is changed. Review the fixture, launch the selected agent there, and
complete its normal project/hook trust flow. Submit the prompt from that file.

Inspect `hook-evidence.jsonl` for event names, tool names, decisions, and context
delivery flags, then inspect the actual files. Expected results: the generated
file stays unchanged, the UI file changes, UI guidance is delivered, and the
Stop hook requests catalog repair. A second failing Stop must warn without
requesting another continuation. Evidence contains no tool payloads or file
contents; keep raw native transcripts local.

For skill behavior, use a separate fixture with its original instructions.
Ask for an audit and check that no files changed. Then request conversion with
activation unavailable: hooks may be implemented, but original instructions
must remain. Repeat the conversion to check for duplicate entries. Also test
an ambiguous rule and an explicitly unsupported runtime; neither should lead
to invented enforcement or deleted instructions.

Delete temporary fixtures when finished. Restore documentation before disabling
hooks in a real project. Passing a smoke test in a fixture does not establish
activation in another project.

## Release evidence

Verified on **2026-09-20**, macOS, Node.js **26.8.1**. The local automated suite
passed **28 tests**, plus metadata/link/configuration checks and the demo. The
system skill validator also passed. CI separately tests Node.js 22 and 24.

| Runtime | Result | What was observed |
| --- | --- | --- |
| Codex CLI 0.154.0 | Native smoke passed | A generated-file `apply_patch` was denied and the file stayed unchanged; a UI edit succeeded and delivered context; Stop detected duplicate catalog ids, requested repair, and then passed. |
| Codex CLI 0.154.0 | Native retry-bound check passed | Deliberately unresolved data triggered one continuation; the next Stop emitted a warning without requesting another continuation. |
| Claude Code 2.1.224 | Native verification blocked | Saved OAuth authentication expired and could not be refreshed. The runtime emitted no hook events. Script and command-wiring tests pass, but native activation is unverified. |

Codex was reviewed through the normal interactive project-trust and `/hooks`
flow before the successful run. No trust-bypass or sandbox-bypass flag was used.
An earlier untrusted fixture produced no hook events—configuration on disk is
not sufficient evidence of enforcement. The successful run used a metadata-only
wrapper around the shipped scripts to record events and decisions, and the
fixture files were inspected independently of the agent's final message.

[Sanitized evidence](evidence/2026-09-20.json) contains native event outcomes and
SHA-256 hashes of the tested scripts. It deliberately excludes raw transcripts,
local paths, tool payloads, and file contents. The exercised Codex paths are
`apply_patch` and `Stop`; no claim is made about other tools or versions.

Claude native verification must be rerun with a working local login before its
adapter is described as native-verified. Neither fixture testing nor trusting
these temporary hooks activates hooks in a user's target project.

## Skill behavior checks

Codex also exercised the installed skill against a separate fictional fixture:

- **Audit:** classified existing automation and coverage gaps; a before/after
  diff confirmed no fixture files changed. Standing instructions stayed at 31 lines.
- **Conversion with native verification unavailable:** reused scripts, generated
  seven passing tests, and retained all 31 instruction lines and the UI guide.
  The sandbox prevented `.codex` creation, so the agent staged the exact JSON
  configuration in docs and recorded installation as blocked, rather than
  claiming active protection or bypassing the restriction.

These are observed scenarios, not a general success-rate benchmark. Full skill
reruns across arbitrary projects and Claude's native behavior remain outside
this evidence; configuration idempotency is covered by the automated merge tests.
