import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const groupOptions = ({ hooks, ...options }) => options;

function validate(config) {
  if (!object(config)) throw new Error('Configuration must be an object.');
  if (config.hooks === undefined) return;
  if (!object(config.hooks)) throw new Error('hooks must be an event object.');
  for (const groups of Object.values(config.hooks)) {
    if (!Array.isArray(groups)) throw new Error('Each event must contain an array of matcher groups.');
    for (const group of groups) {
      if (!object(group) || !Array.isArray(group.hooks) || !group.hooks.every(object)) {
        throw new Error('Each matcher group needs an array of hook handlers.');
      }
    }
  }
}

// Pure merge, deliberately restricted to hook fragments. Different definitions
// of the same command are a conflict, not permission to overwrite user settings.
export function mergeHookConfig(existing, fragment) {
  validate(existing);
  validate(fragment);
  if (Object.keys(fragment).some(key => key !== 'hooks')) {
    throw new Error('The fragment may only contain hooks.');
  }
  const result = structuredClone(existing);
  result.hooks ??= {};
  for (const [event, additions] of Object.entries(fragment.hooks ?? {})) {
    const groups = result.hooks[event] ??= [];
    for (const addition of additions) {
      for (const handler of addition.hooks) {
        let duplicate = false;
        for (const group of groups) {
          for (const present of group.hooks) {
            if (same(present, handler) && same(groupOptions(group), groupOptions(addition))) {
              duplicate = true;
            } else if (typeof handler.command === 'string' && present.command === handler.command) {
              throw new Error(`Conflicting hook command in ${event}; resolve it explicitly.`);
            }
          }
        }
        if (duplicate) continue;
        let group = groups.find(item => same(groupOptions(item), groupOptions(addition)));
        if (!group) {
          group = { ...structuredClone(groupOptions(addition)), hooks: [] };
          groups.push(group);
        }
        group.hooks.push(structuredClone(handler));
      }
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node merge-hook-config.mjs existing.json fragment.json');
    const [existing, fragment] = process.argv.slice(2).map(path => JSON.parse(readFileSync(path, 'utf8')));
    process.stdout.write(`${JSON.stringify(mergeHookConfig(existing, fragment), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof SyntaxError ? 'Invalid configuration JSON.' : error.message}\n`);
    process.exitCode = 1;
  }
}
