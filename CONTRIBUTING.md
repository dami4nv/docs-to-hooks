# Contributing

Start with a concrete instruction and the behavior you want to improve. Small
changes with evidence are easier to review than a new catalogue of generic rules.

## Local checks

Use Node.js 22+ and Git on macOS or Linux. No dependency installation is needed:

```sh
npm test
npm run check
npm run demo
```

Keep the skill entrypoint short. Put runtime-specific details in its references,
and keep reusable code inside the skill so a copied installation is self-contained.
Generated hooks should favor the target project's existing runtime and checks.

## What to include

- A fictional or publicly shareable rule and the intended outcome.
- Allowed, denied, unrelated, malformed, and repeated-event cases as applicable.
- The precise tool paths and failure modes covered, plus remaining gaps.
- For native runtime changes, versioned execution evidence separate from direct
  script tests. Never check in raw agent transcripts or credentials.

For an adapter, verify installation, payloads, configuration merging, native
activation, and rollback. A renamed event is not evidence of compatibility.
Preserve existing user configuration and ensure reruns do not duplicate hooks.

Do not publish customer instructions, private repository details, or claimed
token savings without reproducible measurements. Do not turn uncertain guidance
into a blocking rule or remove instructions before coverage and activation pass.

Contributions are provided under the project's MIT license.
