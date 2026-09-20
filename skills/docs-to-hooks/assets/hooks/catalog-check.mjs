import { resolve } from 'node:path';
import { projectRoot, readSmallFile } from './lib.mjs';

// A small, read-only validator. A real conversion should call the project's
// existing checker where possible, with a timeout and bounded output.
export function checkCatalog(root = projectRoot) {
  let items;
  try { items = JSON.parse(readSmallFile(resolve(root, 'content/catalog.json'))); }
  catch { return 'content/catalog.json must be a readable JSON file of at most 64 KiB.'; }
  if (!Array.isArray(items)) return 'content/catalog.json must contain an array.';
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || typeof item.id !== 'string' || !item.id.trim()
      || typeof item.title !== 'string' || !item.title.trim()) {
      return 'Each catalog entry needs a nonempty string id and title.';
    }
    if (ids.has(item.id)) return 'Catalog ids must be unique.';
    ids.add(item.id);
  }
  return null;
}
