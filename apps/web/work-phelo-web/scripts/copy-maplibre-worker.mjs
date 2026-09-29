// Keeps public/vendor/maplibre-gl-worker.mjs (and the shared chunk it imports) in sync with
// the installed maplibre-gl version. See the comment in src/lib/maplibreWorker.ts for why this
// file needs to be self-hosted rather than loaded from maplibre-gl's own computed URL.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(appRoot, 'node_modules/maplibre-gl/dist');
const destDir = join(appRoot, 'public/vendor');

// The worker is an ES module and imports this chunk as a sibling file at runtime, so both
// must be self-hosted side by side or the module worker 404s on load.
const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

await mkdir(destDir, { recursive: true });
await Promise.all(files.map((file) => copyFile(join(srcDir, file), join(destDir, file))));
console.log(`✓ Copied ${files.join(', ')} to public/vendor/`);
