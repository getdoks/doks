// Migration to 0.3.9: Cloudflare DX.
//
// 1. Splits the `deploy` script into `cf:build` + `cf:deploy` so it
//    maps cleanly onto Workers Builds' two-field model. Adds a
//    `cf-typegen` script so `CloudflareEnv` types regenerate after
//    wrangler.jsonc edits with one command.
// 2. Bumps `.nvmrc` from 20 → 22 (wrangler@4 requires Node 22+). Only
//    rewrites if the file is exactly the previous default; leaves
//    other versions alone.
//
// All idempotent — re-running is a no-op once on 0.3.9 shape. SQLite
// projects (no @opennextjs/cloudflare dep) are untouched.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function migrate({ root }) {
  let touched = 0;
  let isCloudflare = false;

  // 1. package.json: split the deploy script and add cf-typegen.
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    isCloudflare =
      !!pkg.devDependencies?.['@opennextjs/cloudflare'] ||
      !!pkg.dependencies?.['@opennextjs/cloudflare'];

    if (isCloudflare) {
      pkg.scripts = pkg.scripts || {};
      let pkgDirty = false;

      if (!pkg.scripts['cf:build']) {
        pkg.scripts['cf:build'] = 'opennextjs-cloudflare build';
        console.log('  + scripts["cf:build"] = "opennextjs-cloudflare build"');
        pkgDirty = true;
      }
      if (!pkg.scripts['cf:deploy']) {
        pkg.scripts['cf:deploy'] = 'opennextjs-cloudflare deploy';
        console.log('  + scripts["cf:deploy"] = "opennextjs-cloudflare deploy"');
        pkgDirty = true;
      }
      if (!pkg.scripts['cf-typegen']) {
        pkg.scripts['cf-typegen'] =
          'wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts';
        console.log('  + scripts["cf-typegen"] = "wrangler types …"');
        pkgDirty = true;
      }

      // Replace the old chained one-liner with one that calls the
      // split scripts — only if it matches the previous default. Leave
      // any custom deploy script alone.
      if (
        pkg.scripts.deploy ===
        'opennextjs-cloudflare build && opennextjs-cloudflare deploy'
      ) {
        pkg.scripts.deploy = 'npm run cf:build && npm run cf:deploy';
        console.log('  + scripts.deploy = "npm run cf:build && npm run cf:deploy"');
        pkgDirty = true;
      }

      if (pkgDirty) {
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        touched++;
      }
    }
  }

  // 2. .nvmrc: bump 20 → 22, but only on Cloudflare consumers where
  //    wrangler@4 actually forces the requirement. SQLite-only
  //    projects keep whatever they had.
  if (isCloudflare) {
    const nvmrcPath = join(root, '.nvmrc');
    if (existsSync(nvmrcPath)) {
      const cur = readFileSync(nvmrcPath, 'utf8').trim();
      if (cur === '20') {
        writeFileSync(nvmrcPath, '22\n');
        console.log('  + .nvmrc: 20 → 22 (wrangler@4 requires Node 22+)');
        touched++;
      }
    }
  }

  if (!touched) {
    console.log('  (already on 0.3.9 shape, nothing to do)');
  }
}
