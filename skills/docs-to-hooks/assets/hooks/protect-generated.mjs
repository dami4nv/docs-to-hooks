import { resolve } from 'node:path';
import { editedPaths, expectEvent, projectRoot, runHook, touches } from './lib.mjs';

await runHook(event => {
  expectEvent(event, 'PreToolUse');
  if (!touches(editedPaths(event), resolve(projectRoot, 'generated'))) return {};
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Generated files are maintained by the build. Edit their source and regenerate instead.',
    },
  };
}, { guard: true });
