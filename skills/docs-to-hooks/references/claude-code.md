# Claude Code adapter

Reference checked 2026-09-20:
[hooks](https://code.claude.com/docs/en/hooks),
[skills](https://code.claude.com/docs/en/skills).
Compatibility evidence is recorded separately in the repository's verification
guide; a documentation check is not a native runtime test.

## Install and configure

The skill directory belongs in `.claude/skills/docs-to-hooks/` for a project or
`~/.claude/skills/docs-to-hooks/` for personal use. Invoke `/docs-to-hooks` with an
audit or conversion request. Installing the skill alone activates no hooks.

Merge project hook definitions into `.claude/settings.json`, preserving all
other keys and hooks. Put project scripts in `.agent-hooks/` unless the project
already has a convention. Use quoted `${CLAUDE_PROJECT_DIR}` paths to locate the
scripts. The asset [configuration](../assets/config/claude.json) assumes that
directory. The environment variable locates scripts; the event's `cwd` locates
the files the agent is acting on. They can differ after a directory/worktree change.

## Events and wire format

| Purpose | Event | Input |
| --- | --- | --- |
| Guard or scoped guidance before edits | `PreToolUse`, matcher `^(Write|Edit)$` | `tool_input.file_path` with `cwd` |
| Validate at completion | `Stop`, no matcher | `stop_hook_active` |

Inputs are JSON objects on stdin. These examples support native `Write` and
`Edit`; Bash, notebook editing, and MCP writes are outside the edit guard's scope.
Use verified payloads to add other tools when the project needs them.

A denial returns:

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Edit the source, then regenerate this file."}}
```

Success returns `{}` without an `allow` decision: normal permissions still apply.
Context uses `hookSpecificOutput.additionalContext` with the same event name.
A Stop failure uses `{"decision":"block","reason":"Explain the failed check."}`.
On `stop_hook_active: true`, do not request another continuation; report unresolved
failure through `systemMessage`. This is bounded feedback, not an unbreakable gate.

For malformed guard input the supplied script exits 2 with a short stderr
message. Claude treats that as blocking on this event. Advisory scripts return a
warning instead. Explicit synchronous hooks are required for prevention.

## Verify activation

Inspect `/hooks`, accept the normal workspace trust flow, and start a fresh
session after installing or changing configuration. Exercise a harmless allowed
edit and a denied edit in an isolated copy, verifying the file's contents as well
as the hook result. Check context delivery and Stop feedback independently.
Print mode skips the workspace trust dialog and silently ignores invalid settings;
a print-mode smoke test alone does not prove interactive project activation.

Retain documentation until the actual target project's activation is verified.
Do not count a direct script test or an agent's unsubstantiated success claim as
native hook evidence. Record actual version, event, result, and remaining gaps.
