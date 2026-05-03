// Migration to 0.3.6: MDX watch mode in `dev`.
//
// 0.3.0–0.3.5 had a DX gap: `bun run dev` ran the content generator
// once via `predev`, then never again. Editing MDX during dev required
// a manual `bunx doks build:content`. 0.3.6 ships a `--watch` flag on
// the generator and rewires the scaffold's `dev` script to run the
// watcher in parallel with `next dev` via `concurrently`.
//
// This migration:
// 1. Adds `concurrently` to devDependencies.
// 2. Splits the `dev` script into `dev:next` + `dev:content`, with
//    `dev` itself running both via `concurrently`.
// 3. Leaves `predev` and `prebuild` alone (they're still useful for
//    one-shot regen).
//
// Idempotent: safe to re-run.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NEXT_DEV_DEFAULTS = new Set([
  undefined,
  '',
  'next dev',
  'next dev --turbopack',
]);

const CONCURRENT_DEV =
  'concurrently --kill-others-on-fail --names "NEXT,MDX" ' +
  '--prefix-colors "cyan,magenta" "npm:dev:next" "npm:dev:content"';

export default async function migrate({ root }) {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  pkg.devDependencies = pkg.devDependencies || {};

  let dirty = false;

  // 1. Pin concurrently as a devDep.
  if (!pkg.devDependencies.concurrently && !pkg.dependencies?.concurrently) {
    pkg.devDependencies.concurrently = '^9.1.0';
    console.log('  + devDependencies.concurrently = "^9.1.0"');
    dirty = true;
  }

  // 2. dev:next — preserve whatever the user had in `dev` if it's the
  //    default; otherwise leave their custom dev:next alone.
  if (!pkg.scripts['dev:next']) {
    if (NEXT_DEV_DEFAULTS.has(pkg.scripts.dev)) {
      pkg.scripts['dev:next'] = pkg.scripts.dev || 'next dev --turbopack';
      console.log(`  + scripts["dev:next"] = "${pkg.scripts['dev:next']}"`);
      dirty = true;
    } else {
      // User customized `dev` to do more than `next dev`. Leave their
      // setup intact and let them manually wire dev:content.
      console.log(
        '  ⚠ scripts.dev looks customised; not splitting into dev:next/dev:content. ' +
          'Add `"dev:content": "doks build:content --watch"` and run it ' +
          'alongside your existing dev script.',
      );
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      return;
    }
  }

  // 3. dev:content — the new watcher.
  if (pkg.scripts['dev:content'] !== 'doks build:content --watch') {
    pkg.scripts['dev:content'] = 'doks build:content --watch';
    console.log('  + scripts["dev:content"] = "doks build:content --watch"');
    dirty = true;
  }

  // 4. dev — concurrently runs the two.
  if (pkg.scripts.dev !== CONCURRENT_DEV) {
    // Only overwrite if the existing dev was a known default OR was
    // already set to the dev:next version we just minted.
    const allowed = new Set([
      'next dev',
      'next dev --turbopack',
      pkg.scripts['dev:next'],
    ]);
    if (allowed.has(pkg.scripts.dev) || !pkg.scripts.dev) {
      pkg.scripts.dev = CONCURRENT_DEV;
      console.log('  + scripts.dev = concurrently(dev:next, dev:content)');
      dirty = true;
    } else {
      console.log(
        '  ⚠ scripts.dev was customised, leaving as-is. ' +
          'Manually wire it to run both `dev:next` and `dev:content` ' +
          '(via concurrently or a similar tool).',
      );
    }
  }

  if (dirty) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(
      '  Run `npm install` (or your PM equivalent) to install concurrently.',
    );
  } else {
    console.log('  (already on 0.3.6 shape, nothing to do)');
  }
}
