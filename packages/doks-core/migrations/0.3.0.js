// Migration to 0.3.0: bundled-content runtime.
//
// Lets the consumer's doc pages render at request time on edge runtimes
// (Cloudflare Workers, Vercel Edge) without filesystem reads. Adds:
//
// 1. `doks build:content` to `predev` and `prebuild` scripts.
// 2. A side-effect import of `lib/doks-content.gen` in `app/layout.tsx`
//    so the generated snapshot registers with the runtime cache before
//    any data-layer call resolves a doc.
// 3. A `withDoks(nextConfig)` wrapper in `next.config.mjs` so the
//    generator also runs at config-load time (covers `next dev` first
//    boot when the predev hook hasn't fired yet).
// 4. `.gitignore` entries for the generated file and Cloudflare /
//    OpenNext / Wrangler artifacts.
//
// Idempotent: safe to re-run. Doesn't modify content or your site
// config. Existing fs-based fallback in the data layer keeps the site
// working even if the migration is partial.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function migrate({ root }) {
  let touched = 0;

  // 1. package.json: chain `doks build:content` into predev/prebuild.
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    pkg.scripts = pkg.scripts || {};

    // Detect adapter (predev for SQLite chains build:content + ensure-index).
    let isSqlite = true;
    const cfgPath = ['lib/doks.config.ts', 'lib/doks.config.js']
      .map((p) => join(root, p))
      .find(existsSync);
    if (cfgPath) {
      isSqlite = /createSqliteStore/.test(readFileSync(cfgPath, 'utf8'));
    }

    let pkgDirty = false;

    const desiredPredev = isSqlite
      ? 'doks build:content && doks ensure-index'
      : 'doks build:content';
    if (pkg.scripts.predev !== desiredPredev) {
      // Don't clobber a customised predev. Only rewrite if it's empty or
      // matches a known previous default.
      const known = new Set([
        undefined,
        '',
        'doks ensure-index',
        'doks build:content',
        'doks build:content && doks ensure-index',
      ]);
      if (known.has(pkg.scripts.predev)) {
        pkg.scripts.predev = desiredPredev;
        pkgDirty = true;
        console.log(`  + scripts.predev = "${desiredPredev}"`);
      }
    }

    if (pkg.scripts.prebuild !== 'doks build:content') {
      const known = new Set([undefined, '', 'doks build:content']);
      if (known.has(pkg.scripts.prebuild)) {
        pkg.scripts.prebuild = 'doks build:content';
        pkgDirty = true;
        console.log(`  + scripts.prebuild = "doks build:content"`);
      }
    }

    if (pkgDirty) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      touched++;
    }
  }

  // 2. app/layout.tsx: side-effect import of the generated content map.
  const layoutPath = join(root, 'app', 'layout.tsx');
  if (existsSync(layoutPath)) {
    const src = readFileSync(layoutPath, 'utf8');
    if (!/['"]@\/lib\/doks-content\.gen['"]/.test(src)) {
      // Insert after the "./globals.css" import, or at the top if not found.
      const cssImport = src.match(/^import\s+["']\.\/globals\.css["'];?\s*$/m);
      const inject = `import "@/lib/doks-content.gen";\n`;
      let next;
      if (cssImport) {
        const idx = src.indexOf(cssImport[0]) + cssImport[0].length;
        next = src.slice(0, idx) + '\n\n' + inject + src.slice(idx);
      } else {
        next = inject + '\n' + src;
      }
      writeFileSync(layoutPath, next);
      console.log('  + app/layout.tsx: added doks-content.gen side-effect import');
      touched++;
    }
  }

  // 3. next.config.mjs: wrap export with `withDoks(...)`.
  const nextCfgPath = join(root, 'next.config.mjs');
  if (existsSync(nextCfgPath)) {
    const src = readFileSync(nextCfgPath, 'utf8');
    if (!/withDoks\s*\(/.test(src) && !/from\s+['"]doks-core\/next['"]/.test(src)) {
      // Add the import below the last existing import (or at the top).
      const lastImport = [...src.matchAll(/^import\s+[^;]+;\s*$/gm)].pop();
      const importLine = `import { withDoks } from 'doks-core/next';\n`;
      let next = src;
      if (lastImport) {
        const idx = lastImport.index + lastImport[0].length;
        next = src.slice(0, idx) + '\n' + importLine + src.slice(idx);
      } else {
        next = importLine + '\n' + src;
      }
      // Wrap the default export.
      next = next.replace(
        /export\s+default\s+(\w+)\s*;?/,
        'export default withDoks($1);',
      );
      if (next !== src) {
        writeFileSync(nextCfgPath, next);
        console.log('  + next.config.mjs: wrapped export with withDoks(...)');
        touched++;
      } else {
        console.log(
          '  ⚠ next.config.mjs: could not auto-wrap the default export. ' +
            'Add `import { withDoks } from "doks-core/next";` and wrap your ' +
            'config: `export default withDoks(nextConfig);`',
        );
      }
    }
  }

  // 4. .gitignore: add bundled-content + Cloudflare artifacts.
  const gitignorePath = join(root, '.gitignore');
  if (existsSync(gitignorePath)) {
    const src = readFileSync(gitignorePath, 'utf8');
    const additions = [
      'lib/doks-content.gen.ts',
      'lib/doks-content.gen.js',
      '.doks/',
      '.wrangler/',
      '.open-next/',
      '.netlify',
    ];
    const missing = additions.filter((a) => !src.includes(a));
    if (missing.length) {
      const banner = '\n# bundled-content + Cloudflare / OpenNext artifacts (added by doks 0.3.0)\n';
      writeFileSync(gitignorePath, src.trimEnd() + banner + missing.join('\n') + '\n');
      console.log(`  + .gitignore: added ${missing.length} entr${missing.length === 1 ? 'y' : 'ies'}`);
      touched++;
    }
  }

  if (!touched) {
    console.log('  (already on 0.3.0 shape, nothing to do)');
  }
}
