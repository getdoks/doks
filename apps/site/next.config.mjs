// Cloudflare Workers + D1 deployments only.
//
// `getCloudflareContext()` reads from a Worker-side context that doesn't
// exist under `next dev`. OpenNext ships a hook that wires up a local
// shim so dev-time routes can resolve `env.DB` etc. Without it, any
// route that calls `getCloudflareContext()` will 500 in dev.
//
// SQLite-only consumers can leave this commented out. Uncomment when
// switching `lib/doks.config.ts` to the D1 adapter (or run
// `npx doks deploy:cloudflare`, which uncomments this for you).
//
// import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
// initOpenNextCloudflareForDev();

import { resolve } from 'node:path';

import { withDoks } from 'doks-core/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the workspace package so it's compiled at dev time.
  transpilePackages: ['doks-core'],

  // better-sqlite3 + sqlite-vec ship native bindings; never bundle them.
  serverExternalPackages: ['better-sqlite3', 'sqlite-vec'],

  // Pin Turbopack's workspace root. Without this, Turbopack walks up
  // looking for the nearest lockfile and may pick a stray one in a
  // parent / sibling directory, warning on every dev start.
  //
  // In the doks monorepo this points at the repo root so Turbopack can
  // see hoisted workspace deps (Next, etc.). `create-doks` rewrites
  // this to `import.meta.dirname` when scaffolding a standalone
  // consumer — see packages/create-doks/index.js.
  turbopack: {
    root: resolve(import.meta.dirname, '..', '..'),
  },
};

// `withDoks` runs the build-time content generator (writes
// lib/doks-content.gen.ts) and returns the same NextConfig. Idempotent.
export default withDoks(nextConfig);
