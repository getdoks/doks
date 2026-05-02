// Migration to 0.2.4: predev hook auto-runs ingest.
//
// Adds `"predev": "doks ensure-index"` to consumer's package.json so the
// first `npm run dev` builds `data/docs.db` if it's missing. The
// `ensure-index` subcommand quietly noops for D1 consumers (they own the
// ingest cadence via DOKS_CONFIG), so the hook is safe to add for both
// adapter shapes — but we only add it to SQLite consumers to avoid an
// unnecessary subprocess on every dev boot.
//
// Idempotent: safe to re-run.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function migrate({ root }) {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};

  // Detect adapter from lib/doks.config.ts.
  const candidates = ['lib/doks.config.ts', 'lib/doks.config.js'];
  let isSqlite = true;
  for (const rel of candidates) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, 'utf8');
    isSqlite = /createSqliteStore/.test(src);
    break;
  }

  if (!isSqlite) {
    console.log('  ✓ non-SQLite adapter detected; skipping predev hook');
    return;
  }

  if (pkg.scripts.predev) {
    console.log(`  ✓ predev script already set ('${pkg.scripts.predev}'), skipped`);
    return;
  }

  pkg.scripts.predev = 'doks ensure-index';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('  + added "predev": "doks ensure-index" to package.json');
}
