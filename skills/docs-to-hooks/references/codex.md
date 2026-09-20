# Codex adapter

Reference checked 2026-09-20:
[hooks](https://learn.chatgpt.com/docs/hooks),
[skills](https://learn.chatgpt.com/docs/build-skills).
Verify installed runtime support; older releases may have fewer hook events.

## Install and configure

The skill directory belongs in `.agents/skills/docs-to-hooks/` for a project or
`~/.agents/skills/docs-to-hooks/` for personal use. Invoke `$docs-to-hooks` with an
audit or conversion request. Installing the skill alone activates no hooks.

Inspect `.codex/hooks.json` and inline `[hooks]` in `.codex/config.toml` first.
Preserve the representation already in use; default to JSON when neither exists.
Both sources are additive, so writing a second representation can duplicate runs.
Do not migrate or overwrite existing TOML to use the JSON merge helper.

The [configuration asset](../assets/config/codex.json) assumes a Git project and
scripts in `.agent-hooks/`. Its quoted `git rev-parse --show-toplevel` resolves the
active checkout from nested working directories, including linked worktrees.
For a non-Git project, adapt script resolution and test it; do not paste this
configuration unchanged. Preserve existing trust and permission settings.

## Events and wire format

| Purpose | Event | Input |
| --- | --- | --- |
| Guard or guidance before edits | `PreToolUse`, matcher `^apply_patch$` | `tool_input.command` containing patch text, with `cwd` |
| Validate at completion | `Stop`, no matcher | `stop_hook_active` |

`apply_patch` also has `Edit`/`Write` matcher aliases, but its input still reports
`apply_patch`. Shell tools including `exec_command` match as `Bash`; do not assume
raw tool names match hook names. Hosted tools and some specialized paths do not
pass through the same hooks. Shell writes and interactive stdin are not covered
by the example edit guard.

Input is JSON on stdin. Plain stdout is ignored for `PreToolUse`; use:

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Edit the source, then regenerate this file."}}
```

Return `{}` on success without approving the tool. Guidance uses
`hookSpecificOutput.additionalContext` and `hookEventName: "PreToolUse"`.
Do not use Claude-only `ask` decisions: unsupported fields can fail the hook
without blocking the tool. Malformed guard payloads use exit 2 and stderr.

Stop requires JSON: `{}` for success, or `{"decision":"block","reason":"…"}`
to request continuation. Honor `stop_hook_active`; on a repeated failure return
`systemMessage` without another block. Stop feedback cannot prove tests passed.

## Verify activation

Project config loads only for trusted projects. New or changed unmanaged hooks
also need definition-specific trust; `/hooks` lets the user inspect and trust
them. Do not edit trust records or bypass trust to claim activation. Finish
implementation and tests first, then report any native trust action still needed.

After trust, use an isolated fixture to observe allowed/denied edits, guidance,
and bounded Stop feedback. Confirm the protected file remained unchanged. Repeat
in the actual target project before removing instructions. Record installed
version and which tool paths were exercised, including gaps. A test run with
special trust overrides must be labeled separately and cannot justify trimming.
