// Keeps public/vendor/maplibre-gl-worker.mjs in sync with the installed maplibre-gl version.
// See the comment in src/components/organisms/marketing/CompanyLocationMap.tsx for why this
// file needs to be self-hosted rather than loaded from maplibre-gl's own computed URL.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(appRoot, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs');
const destDir = join(appRoot, 'public/vendor');
const dest = join(destDir, 'maplibre-gl-worker.mjs');

await mkdir(destDir, { recursive: true });
await copyFile(source, dest);
console.log('✓ Copied maplibre-gl worker to public/vendor/maplibre-gl-worker.mjs');
