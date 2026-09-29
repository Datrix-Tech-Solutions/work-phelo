import { setWorkerUrl } from 'maplibre-gl';

// maplibre-gl builds its worker URL from `import.meta.url` at runtime, which Turbopack can't
// statically resolve when the code lives inside a pre-built node_modules package — the worker
// never starts. The map still renders a base style without it, but anything that needs the
// worker (zooming, panning the camera) leaves its internal transform half-initialized and
// throws reading `.center` off it.
//
// Fix: self-host the exact worker file the installed version ships, same-origin, so the
// browser can just fetch it directly with no bundler resolution involved at request time.
// public/vendor/maplibre-gl-worker.mjs is a straight copy of
// node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs, kept in sync automatically by
// scripts/copy-maplibre-worker.mjs (wired to `postinstall`).
//
// `/vendor/*` must also stay excluded from src/middleware.ts's tenant-auth matcher — otherwise
// an unauthenticated request for this file gets redirected to a login page's HTML instead of
// served as JS, which throws this same "Worker failed to load" error at the Worker constructor.
export function initMaplibreWorker() {
  if (typeof window === 'undefined') return;
  setWorkerUrl('/vendor/maplibre-gl-worker.mjs');
}

initMaplibreWorker();
