// Migration to 0.2.0: pluggable vector-store adapters (RFC 0001).
//
// Public-API break in 0.2.0:
// - `lib/db` (and the legacy `getDb`/`vectorSearch` helpers) was removed.
// - The search route now imports `createSearchHandler` and a `vectorStore`,
//   instead of re-exporting `POST`/`GET` from `doks-core/api/search`.
// - The ingest CLI loads the consumer's `vectorStore` from
//   `lib/doks.config.ts` (or the SQLite default if missing).
//
// This migration:
// 1. Writes `lib/doks.config.ts` with the SQLite adapter (matching today's
//    behaviour).
// 2. Rewrites `app/api/docs/search/route.ts` to use the new factory.
// 3. Updates the consumer's `package.json` so the ingest script invokes
//    via `tsx` (needed to load the TS config dynamically).
//
// Idempotent: safe to re-run.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DOKS_CONFIG_TS = `// Vector-store configuration. Both the search route and the ingest CLI
// read from here, so switching backends is a one-file edit.
//
// To deploy on Cloudflare Pages, swap the SQLite import:
//   import { createD1Store } from "doks-core/adapters/d1";
//   export const vectorStore = createD1Store(globalThis.env.DB);

import { createSqliteStore } from "doks-core/adapters/sqlite";
import type { VectorStore } from "doks-core";

export const vectorStore: VectorStore = createSqliteStore({
  path: "data/docs.db",
});
`;

const ROUTE_TS = `import { createSearchHandler } from "doks-core";
import { vectorStore } from "@/lib/doks.config";

// SQLite needs the Node runtime. A D1 / edge-compatible store would
// drop or override this line.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { POST, GET } = createSearchHandler(vectorStore);
`;

export default async function migrate({ root }) {
  let touched = 0;

  // 1. Write lib/doks.config.ts if not already present.
  const configPath = join(root, 'lib', 'doks.config.ts');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, DOKS_CONFIG_TS);
    console.log('  + wrote lib/doks.config.ts (SQLite adapter)');
    touched++;
  } else {
    // Idempotent: skip if already configured.
    console.log('  ✓ lib/doks.config.ts already exists, skipped');
  }

  // 2. Rewrite app/api/docs/search/route.ts only if it still uses the
  //    pre-0.2.0 re-export form. Don't clobber a customised route.
  const routePath = join(root, 'app', 'api', 'docs', 'search', 'route.ts');
  if (existsSync(routePath)) {
    const src = readFileSync(routePath, 'utf8');
    const isLegacy =
      /from\s+["']doks-core\/api\/search["']/.test(src) &&
      !/createSearchHandler/.test(src);
    if (isLegacy) {
      writeFileSync(routePath, ROUTE_TS);
      console.log('  + rewrote app/api/docs/search/route.ts (factory form)');
      touched++;
    } else if (/createSearchHandler/.test(src)) {
      console.log(
        '  ✓ app/api/docs/search/route.ts already on the factory form',
      );
    } else {
      console.log(
        '  ⚠ app/api/docs/search/route.ts looks customised; left alone. ' +
          'Make sure it uses createSearchHandler + vectorStore.',
      );
    }
  }

  // 3. Update package.json's ingest script to invoke via tsx so the
  //    dynamic import of lib/doks.config.ts works without a build step.
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (
      pkg.scripts &&
      typeof pkg.scripts.ingest === 'string' &&
      !pkg.scripts.ingest.startsWith('tsx ') &&
      pkg.scripts.ingest.includes('doks-core/dist/scripts/ingest.js')
    ) {
      pkg.scripts.ingest = `tsx ${pkg.scripts.ingest.replace(/^node\s+/, '')}`;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log('  + updated package.json ingest script to use tsx');
      touched++;
    }
  }

  if (!touched) {
    console.log('  (already on 0.2.0 shape, nothing to do)');
  }
}
