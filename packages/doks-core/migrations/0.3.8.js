// Migration to 0.3.8: pin Turbopack's workspace root in next.config.mjs.
//
// Without this, Turbopack walks up the filesystem looking for the
// nearest lockfile and can pick a stray one in a parent / sibling
// directory (a `~/bun.lock` left over from running `bun add` in $HOME,
// for example). Result: every `next dev` prints a warning, and in some
// cases Turbopack actually loads dependencies from the wrong root.
//
// This migration injects:
//
//   turbopack: {
//     root: import.meta.dirname,
//   }
//
// into the consumer's `nextConfig` object. Idempotent — skipped if any
// `turbopack` config is already present.
//
// `import.meta.dirname` requires Node 20+; doks-core's `engines.node`
// already pins ">=20", so consumers on supported Node will be fine.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TURBOPACK_BLOCK = `\n  // Pin Turbopack's workspace root to this project. Without it,\n  // Turbopack walks up and may pick a stray lockfile in a parent or\n  // sibling directory, then warn on every dev start.\n  turbopack: {\n    root: import.meta.dirname,\n  },\n`;

export default async function migrate({ root }) {
  const candidates = ['next.config.mjs', 'next.config.js', 'next.config.ts'];

  for (const rel of candidates) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;

    const src = readFileSync(abs, 'utf8');

    if (/\bturbopack\s*:/.test(src)) {
      console.log(`  ✓ ${rel}: turbopack config already present, skipped`);
      return;
    }

    // Find the start of `const nextConfig = { ... }`.
    const startMatch = src.match(/(?:const|let|var)\s+nextConfig\s*=\s*\{/);
    if (!startMatch) {
      console.log(
        `  ⚠ ${rel}: couldn't locate \`const nextConfig = { ... }\`. ` +
          `Add this manually inside your config object:\n` +
          `      turbopack: { root: import.meta.dirname },`,
      );
      return;
    }

    // Walk forward from the opening `{`, tracking brace depth, until we
    // find the matching close. Skip braces inside strings and comments —
    // good enough for typical Next configs (full JS parse would be
    // overkill here).
    const openIdx = startMatch.index + startMatch[0].length - 1; // position of `{`
    let i = openIdx + 1;
    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;

    while (i < src.length && depth > 0) {
      const c = src[i];
      const next2 = src.slice(i, i + 2);

      if (inLineComment) {
        if (c === '\n') inLineComment = false;
      } else if (inBlockComment) {
        if (next2 === '*/') {
          inBlockComment = false;
          i++;
        }
      } else if (inSingle) {
        if (c === '\\') i++;
        else if (c === "'") inSingle = false;
      } else if (inDouble) {
        if (c === '\\') i++;
        else if (c === '"') inDouble = false;
      } else if (inTemplate) {
        if (c === '\\') i++;
        else if (c === '`') inTemplate = false;
      } else {
        if (next2 === '//') {
          inLineComment = true;
          i++;
        } else if (next2 === '/*') {
          inBlockComment = true;
          i++;
        } else if (c === "'") inSingle = true;
        else if (c === '"') inDouble = true;
        else if (c === '`') inTemplate = true;
        else if (c === '{') depth++;
        else if (c === '}') depth--;
      }
      i++;
    }

    if (depth !== 0) {
      console.log(
        `  ⚠ ${rel}: couldn't find the closing brace of nextConfig. ` +
          `Add this manually inside the config object:\n` +
          `      turbopack: { root: import.meta.dirname },`,
      );
      return;
    }

    // i is now one past the closing `}`. Inject the block just before it.
    const injectAt = i - 1;
    const next = src.slice(0, injectAt) + TURBOPACK_BLOCK + src.slice(injectAt);

    writeFileSync(abs, next);
    console.log(`  + ${rel}: added \`turbopack.root: import.meta.dirname\``);
    return;
  }

  console.log('  (no next.config.{mjs,js,ts} found, nothing to do)');
}
