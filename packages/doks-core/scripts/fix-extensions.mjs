#!/usr/bin/env node
//
// Postbuild script: walk dist/ and add the correct extension to every
// extension-less relative import. Required because TypeScript does not
// rewrite import specifiers and Node's strict ESM resolver does not
// auto-resolve `./foo` to `./foo.js` (or `./foo.jsx`, or `./foo/index.js`).
//
// Without this fix, `node node_modules/doks-core/dist/scripts/ingest.js`
// blows up with `Cannot find module './lib/chunks'` because chunks.js is
// imported as `./chunks` not `./chunks.js`.
//
// Runs after `tsc` as part of `prepack`.

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
);

async function walkJs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkJs(full)));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      out.push(full);
    }
  }
  return out;
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveExt(targetAbs) {
  // Already has an extension we trust? Leave it alone.
  if (/\.(m?js|mjs|cjs|jsx|json)$/i.test(targetAbs)) return null;

  if (await fileExists(targetAbs + '.js')) return '.js';
  if (await fileExists(targetAbs + '.jsx')) return '.jsx';

  const indexJs = join(targetAbs, 'index.js');
  if (await fileExists(indexJs)) return '/index.js';

  const indexJsx = join(targetAbs, 'index.jsx');
  if (await fileExists(indexJsx)) return '/index.jsx';

  return null;
}

// Match `from '<spec>'`, `from "<spec>"`, `import('<spec>')`, `export ... from '<spec>'`.
const SPEC_RE =
  /(\b(?:from|import)\s*\(?\s*['"])(\.{1,2}\/[^'"\n]+?)(['"])/g;

async function fixFile(file) {
  const src = await readFile(file, 'utf8');
  const dir = dirname(file);
  const matches = [...src.matchAll(SPEC_RE)];
  if (!matches.length) return false;

  let out = '';
  let last = 0;
  let dirty = false;

  for (const m of matches) {
    const [whole, pre, spec, post] = m;
    out += src.slice(last, m.index);
    last = m.index + whole.length;

    const targetAbs = resolve(dir, spec);
    const ext = await resolveExt(targetAbs);

    if (ext) {
      out += `${pre}${spec}${ext}${post}`;
      dirty = true;
    } else {
      out += whole;
    }
  }
  out += src.slice(last);

  if (dirty) await writeFile(file, out);
  return dirty;
}

const files = await walkJs(ROOT);
let touched = 0;
for (const file of files) {
  if (await fixFile(file)) touched += 1;
}
console.log(
  `fix-extensions: rewrote relative imports in ${touched}/${files.length} dist file(s).`,
);
