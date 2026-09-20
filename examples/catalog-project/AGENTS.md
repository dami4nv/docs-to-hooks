# Catalog workshop

This is a local catalog browser. Keep browsing available without a network.
Prefer small changes that preserve the existing data format.

## Generated files

Files in generated/ belong to the build.
Edit their source and regenerate instead of patching output.
This applies to shell commands as well as native file-edit tools.

## UI changes

When editing src/ui/, follow the interaction guide in docs/ui.md.
Every action needs a keyboard path.
Keep focus visible when moving between catalog entries.
An empty catalog should explain what happened and offer a useful next step.
Loading, empty, and error states are distinct; do not collapse them.
Check these states in the UI, not just in a screenshot of populated data.

## Catalog checks

At the end of a turn, validate content/catalog.json.
It must be a JSON array of objects with unique, nonempty string ids.
Each entry must also have a nonempty string title.
If validation fails, attempt a focused repair once, then report unresolved failure.
Do not present an unresolved check as passing.

## Architecture

Keep the catalog renderer independent of transport so local previews stay useful.
