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

import { withDoks } from 'doks-core/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the workspace package so it's compiled at dev time.
  transpilePackages: ['doks-core'],

  // better-sqlite3 + sqlite-vec ship native bindings; never bundle them.
  serverExternalPackages: ['better-sqlite3', 'sqlite-vec'],
};

// `withDoks` runs the build-time content generator (writes
// lib/doks-content.gen.ts) and returns the same NextConfig. Idempotent.
export default withDoks(nextConfig);
