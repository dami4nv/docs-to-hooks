import { cpSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../', import.meta.url));
export const asset = join(repo, 'skills/docs-to-hooks/assets');

export function createFixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'docs-to-hooks fixture ')));
  cpSync(join(repo, 'examples/catalog-project'), root, { recursive: true });
  cpSync(join(asset, 'hooks'), join(root, '.agent-hooks'), { recursive: true });
  return {
    root,
    write(path, contents) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    },
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}
