# Catalog workshop

This is a local catalog browser. Keep browsing available without a network.
Prefer small changes that preserve the existing data format.

## Safeguards

Files in generated/ belong to the build. Edit their source and regenerate.
This applies to shell commands too; the edit hook covers only native file tools.
UI edit guidance is supplied by .agent-hooks/ui-context.mjs; docs/ui.md is authoritative.
The bounded Stop check validates catalog structure and reports unresolved failure.
Its implementation is .agent-hooks/validate-stop.mjs; do not claim a failing check passed.

## Architecture

Keep the catalog renderer independent of transport so local previews stay useful.
