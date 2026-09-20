import { resolve } from 'node:path';
import { editedPaths, expectEvent, projectRoot, runHook, touches } from './lib.mjs';

await runHook(event => {
  expectEvent(event, 'PreToolUse');
  if (!touches(editedPaths(event), resolve(projectRoot, 'src/ui'))) return {};
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: 'UI edit: read docs/ui.md for keyboard interaction and empty-state conventions. This reminder does not verify compliance.',
    },
  };
});
