import { checkCatalog } from './catalog-check.mjs';
import { expectEvent, runHook } from './lib.mjs';

await runHook(event => {
  expectEvent(event, 'Stop');
  if (typeof event.stop_hook_active !== 'boolean') {
    throw new Error('Stop input requires stop_hook_active.');
  }
  const error = checkCatalog();
  if (!error) return {};
  if (event.stop_hook_active) {
    return { systemMessage: `Catalog validation still fails: ${error} No further continuation requested. Report this unresolved check.` };
  }
  return { decision: 'block', reason: `Catalog validation failed: ${error} Fix the catalog or explain why the check cannot be completed; do not disable the hook.` };
});
