import { readdir, stat } from 'fs/promises';
import path from 'path';
import process from 'process';

const ROOT = process.cwd();
const SEARCH_ROOTS = ['apps', 'packages'];
const GENERATED_EXTENSIONS = ['.js', '.d.ts', '.map'];
const IGNORED_SEGMENTS = new Set(['node_modules', 'dist', '.next', '.turbo']);

async function walk(dir, onlyInsideSourceTree = false) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (IGNORED_SEGMENTS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'src') {
        results.push(...(await walk(fullPath, true)));
        continue;
      }

      if (!onlyInsideSourceTree) {
        results.push(...(await walk(fullPath, false)));
      }
      continue;
    }

    if (onlyInsideSourceTree && GENERATED_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

async function main() {
  const matches = [];

  for (const rootName of SEARCH_ROOTS) {
    const rootPath = path.join(ROOT, rootName);
    try {
      const rootStats = await stat(rootPath);
      if (!rootStats.isDirectory()) continue;
    } catch {
      continue;
    }

    matches.push(...(await walk(rootPath)));
  }

  if (matches.length === 0) {
    console.log('No generated artifacts found in app/package source trees.');
    return;
  }

  console.error('Generated artifacts found in source trees:');
  for (const match of matches.sort()) {
    console.error(path.relative(ROOT, match));
  }
  console.error('Remove these files and keep build output in dist/ only.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});