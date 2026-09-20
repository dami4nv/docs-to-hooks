import { lstatSync, realpathSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Copy this entire directory to <project>/.agent-hooks/. The script location is
// the policy root; event.cwd is the base for tool paths, not the policy root.
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_INPUT_BYTES = 128 * 1024;

export async function readEvent(stream = process.stdin) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_INPUT_BYTES) throw new Error('Hook input exceeds 128 KiB.');
    chunks.push(bytes);
  }
  let event;
  try { event = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Hook input must be valid JSON.'); }
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('Hook input must be an object.');
  }
  return event;
}

export function expectEvent(event, name) {
  if (event.hook_event_name !== name) throw new Error(`Expected ${name} event.`);
}

export function editedPaths(event) {
  if (!['Write', 'Edit', 'apply_patch'].includes(event.tool_name)) return [];
  if (typeof event.cwd !== 'string' || !isAbsolute(event.cwd)) {
    throw new Error('File-edit input requires an absolute cwd.');
  }
  const input = event.tool_input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('File-edit input requires tool_input.');
  }
  let paths;
  if (event.tool_name === 'apply_patch') {
    if (typeof input.command !== 'string') throw new Error('Patch input requires command text.');
    const lines = input.command.replaceAll('\r\n', '\n').trimEnd().split('\n');
    if (lines[0] !== '*** Begin Patch' || lines.at(-1) !== '*** End Patch') {
      throw new Error('Unrecognized patch envelope.');
    }
    // This extracts paths from the native patch format; it is not a shell or
    // general diff parser. Added content has a + prefix and cannot be a header.
    paths = [];
    for (const line of lines.slice(1, -1)) {
      const match = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/.exec(line);
      if (match) paths.push(match[1]);
      else if (line.startsWith('*** ') && line !== '*** End of File') {
        throw new Error('Unrecognized patch header.');
      }
    }
    if (!paths.length) throw new Error('Patch contains no file paths.');
  } else {
    paths = [input.file_path];
  }
  return paths.map(path => {
    if (typeof path !== 'string' || !path.trim() || path.includes('\0')) {
      throw new Error('File-edit input requires a nonempty file path.');
    }
    return resolve(event.cwd, path);
  });
}

export function isWithin(path, directory) {
  const rel = relative(directory, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

// Resolve existing ancestors too, so a new file beneath a symlink is checked.
export function physicalPath(path) {
  try {
    lstatSync(path);
    return realpathSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Cannot resolve an edit path.');
    // A broken symlink has lstat metadata but no realpath. Reject ambiguity.
    try {
      if (lstatSync(path).isSymbolicLink()) throw new Error('Cannot resolve an edit symlink.');
    } catch (inner) {
      if (inner.code !== 'ENOENT') throw inner;
    }
    const parent = dirname(path);
    if (parent === path) throw new Error('Cannot resolve an edit path.');
    return resolve(physicalPath(parent), relative(parent, path));
  }
}

export function touches(paths, directory) {
  return paths.some(path => isWithin(path, directory)
    || isWithin(physicalPath(path), physicalPath(directory)));
}

export function readSmallFile(path, maxBytes = 64 * 1024) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
    throw new Error('Expected a regular file no larger than 64 KiB.');
  }
  const content = readFileSync(path);
  if (content.length > maxBytes) throw new Error('File exceeds 64 KiB.');
  return content.toString('utf8');
}

export function emit(result = {}) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

export async function runHook(handler, { guard = false } = {}) {
  try { emit(await handler(await readEvent())); }
  catch {
    // Never echo the payload, file contents, or parser exception: they may
    // contain private data. Guard failures explicitly deny; reminders warn.
    const message = 'docs-to-hooks: input or project data could not be checked. Inspect the hook configuration and payload shape.';
    if (guard) {
      process.stderr.write(`${message}\n`);
      process.exitCode = 2;
    } else {
      emit({ systemMessage: message });
    }
  }
}
