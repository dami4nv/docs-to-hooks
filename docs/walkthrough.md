# From a rule to a hook

The fictional [catalog project](../examples/catalog-project/AGENTS.md) has a
generated index, UI guidance, and a small JSON data file. Nothing in this example
needs a network or a model call to evaluate a hook.

## 1. Classify before converting

| Rule | Decision | Remaining responsibility |
| --- | --- | --- |
| Generated files belong to the build | Native edit guard | Retain the broad rule: shell and alternate writes are not covered. |
| UI edits need the interaction guide | Scoped context | Keep the guide; the hook cannot verify the UI follows it. |
| Catalog needs validation at turn end | Bounded Stop validator | Report failures after the retry limit; never claim all checks passed. |
| Offline browsing and transport independence | Keep in docs | These require design judgment. |

## 2. Adapt and wire the scripts

The assets are examples, not an installer. In an isolated copy of this fixture,
copy `skills/docs-to-hooks/assets/hooks/` to `.agent-hooks/`. That directory must
sit at the project root: the scripts derive their policy root from their own
location, and resolve relative edit paths against the event's `cwd`.

Merge the appropriate [Claude fragment](../skills/docs-to-hooks/assets/config/claude.json)
or [Codex fragment](../skills/docs-to-hooks/assets/config/codex.json) into existing
project configuration. For JSON, the helper prints a merge without modifying
either input:

```sh
node /path/to/docs-to-hooks/skills/docs-to-hooks/scripts/merge-hook-config.mjs \
  .claude/settings.json \
  /path/to/docs-to-hooks/skills/docs-to-hooks/assets/config/claude.json \
  > /tmp/docs-to-hooks-merged.json
```

If the destination does not exist, the fragment itself is the starting
configuration. Inspect the merged diff before replacing the destination. Never
redirect output to the input file: the shell would truncate it first. The helper
rejects conflicting definitions of the same command and deduplicates exact
entries; it does not normalize equivalent shell commands or edit TOML.

Codex can use inline hooks in `.codex/config.toml`. If those are already present,
extend them in place instead of adding the same hooks in JSON. Existing user,
project, and plugin hooks may all run; inspect effective configuration too.

## 3. Test the behavior

The following native payload shapes should deny editing the generated index.
Use the actual absolute fixture directory for `cwd`:

```json
{
  "hook_event_name": "PreToolUse",
  "cwd": "/path/to/catalog-project",
  "tool_name": "Write",
  "tool_input": { "file_path": "generated/catalog-index.json", "content": "{}" }
}
```

```json
{
  "hook_event_name": "PreToolUse",
  "cwd": "/path/to/catalog-project",
  "tool_name": "apply_patch",
  "tool_input": {
    "command": "*** Begin Patch\n*** Delete File: generated/catalog-index.json\n*** End Patch"
  }
}
```

The guard returns `permissionDecision: "deny"`; a source-file edit returns `{}`
and remains subject to normal agent permissions. Changes under `src/ui/` also
receive a short reference to `docs/ui.md` from the context hook.

The Stop payload is `{"hook_event_name":"Stop","stop_hook_active":false}`.
A valid catalog produces `{}`. A duplicate id, missing title, malformed file,
or oversized file produces a block decision asking for repair. On the next
`stop_hook_active: true` invocation, the validator checks again: success is
quiet, while continued failure emits a warning without requesting another turn.

Run `npm test` for these and other cases. Passing this test suite proves script
behavior and example command wiring, not that your agent has loaded the hooks.

## 4. Verify activation before shortening docs

Use `/hooks` in the target agent to inspect active configuration. Complete the
agent's normal trust/review flow; in Codex, new or changed hooks require their
own trust in addition to project trust. Start a fresh session as needed.

In an isolated fixture, attempt a protected native edit, an allowed UI edit, and
a completion with an invalid catalog. Observe actual hook execution and inspect
files. Then verify the wiring in the target project. Record runtime versions,
results, and gaps before shortening any covered instruction.

The [after-state](../examples/after/AGENTS.md) retains intent and the broad
generated-file rule. If activation is pending or any relevant test fails, leave
the original instructions in place and record the remaining action.

## Coverage and failure behavior

| Example | Scope | Failure behavior |
| --- | --- | --- |
| Protected-file guard | Claude `Write`/`Edit`; Codex `apply_patch`, including move destinations | Denies matching paths; malformed matched input exits 2. |
| UI guidance | Those same native edits under `src/ui/` | Emits context; malformed input gives a warning without blocking. |
| Catalog validator | The root `content/catalog.json` on `Stop` | One continuation request; persistent failure is reported without an endless loop. |

The guard resolves existing symlinks and ancestors of new paths, but it is not
a filesystem security boundary. Concurrent changes, shell writes, notebooks,
MCP tools, hosted tools, disabled hooks, and missing runtimes are outside its
guarantee. An unavailable script or a host timeout may fail open; retain broader
safeguards and native permissions. Hooks for one project are not a global policy.

Input is limited to 128 KiB, the catalog to 64 KiB, and configured hook timeouts
to five seconds. Large edits beyond this input bound are explicitly denied by
the guard; adapt the bound to the project and retest. Scripts never evaluate
shell text from tool input. Error messages omit input and file contents.

Each hook invocation starts a Node.js process. Scoped matching limits when the
examples run, but the context hook can repeat guidance on successive edits.
The Stop check runs even on a conversational turn. Consider task relevance and
measured latency before adopting that pattern for expensive checks.

## Rollback

Restore shortened instructions first. Remove only the hook entries added by the
conversion, preserving unrelated handlers and settings. Remove scripts only
after checking they are no longer referenced. Keep the conversion record so the
coverage decision remains understandable; update it to say the hooks are disabled.
