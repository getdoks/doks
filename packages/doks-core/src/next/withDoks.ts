// `withDoks(config)` — Next.js config wrapper. Owns the build-time
// content snapshot generation so the consumer doesn't have to add
// `prebuild`/`predev` scripts manually.
//
// Usage:
//
//   // next.config.mjs
//   import { withDoks } from "doks-core/next";
//
//   /** @type {import('next').NextConfig} */
//   const nextConfig = {
//     transpilePackages: ["doks-core"],
//     serverExternalPackages: ["better-sqlite3", "sqlite-vec"],
//   };
//
//   export default withDoks(nextConfig);
//
// `withDoks` runs the content generator at config-load time, which fires
// once per `next dev` / `next build` invocation. The scaffold also wires
// `predev`/`prebuild` scripts as a belt-and-suspenders fallback. The two
// paths are idempotent (both writing the same file).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildContent } from '../scripts/buildContent';

export interface WithDoksOptions {
  /** Where doc MDX lives. Defaults to `content/docs`. */
  docsDir?: string;
  /** Output path for the generated content map. Defaults to `lib/doks-content.gen.ts`. */
  outFile?: string;
  /**
   * Disable the build-time generator entirely. Use this if you're driving
   * the snapshot yourself (e.g. from a custom CI step). Default `false`.
   */
  disableContentSnapshot?: boolean;
  /** Suppress the generator's stdout. Default `true`. */
  silent?: boolean;
  /**
   * Skip the layout-import linter. The linter checks `app/layout.tsx`
   * for a side-effect import of the generated content map and warns at
   * config-load time when it's missing — the most common cause of doc
   * pages 404'ing on edge runtimes. Default `false` (linter on).
   */
  skipLayoutCheck?: boolean;
}

let _generated = false;
const _layoutChecked = new Set<string>();

function checkLayoutImport(outFile: string): void {
  const root = process.cwd();
  // Track per-cwd so multiple withDoks calls from different projects in
  // the same process (uncommon outside tests) each get a check, while
  // repeat calls from the same project only warn once.
  if (_layoutChecked.has(root)) return;
  _layoutChecked.add(root);
  // Match the candidate paths Next.js itself supports.
  const candidates = [
    'app/layout.tsx',
    'app/layout.jsx',
    'app/layout.ts',
    'app/layout.js',
    'src/app/layout.tsx',
    'src/app/layout.jsx',
    'src/app/layout.ts',
    'src/app/layout.js',
  ];
  const layout = candidates
    .map((rel) => ({ rel, abs: join(root, rel) }))
    .find(({ abs }) => existsSync(abs));

  if (!layout) {
    // No conventional layout. Either custom layout path or this isn't
    // an App Router project. Don't false-positive — silent skip.
    return;
  }

  const src = readFileSync(layout.abs, 'utf8');
  // Match any import that ends in `doks-content.gen` (with or without
  // extension), regardless of whether the consumer used `@/`, `./`,
  // or `../` to reach it.
  if (/['"][^'"]*doks-content\.gen(?:\.[mc]?[jt]sx?)?['"]/.test(src)) {
    return;
  }

  // Compute a hint that uses the same alias style the user likely has.
  const hint = outFile.startsWith('lib/')
    ? `import "@/${outFile.replace(/\.tsx?$/, '')}";`
    : `import "${outFile.replace(/\.tsx?$/, '')}";`;

  console.warn(
    `\n[doks] withDoks: ${layout.rel} does not import the bundled ` +
      `content map. Doc pages will 404 on edge runtimes (Cloudflare ` +
      `Workers, Vercel Edge) because setContentMap() never runs.\n` +
      `\n` +
      `  Add this near the top of ${layout.rel}:\n` +
      `    ${hint}\n` +
      `\n` +
      `  Or run \`npx doks upgrade\` to do it for you.\n` +
      `  Pass \`{ skipLayoutCheck: true }\` to withDoks to silence this.\n`,
  );
}

// Loose type. Avoiding a hard `next` import keeps doks-core importable
// without `next` resolved (e.g. from the ingest CLI).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NextConfigLike = Record<string, any>;

export function withDoks(
  config: NextConfigLike = {},
  options: WithDoksOptions = {},
): NextConfigLike {
  if (!_generated && !options.disableContentSnapshot) {
    _generated = true;
    try {
      buildContent({
        docsDir: options.docsDir,
        outFile: options.outFile,
        silent: options.silent ?? true,
      });
    } catch (err) {
      console.warn(
        `[doks] withDoks: content generator failed (${(err as Error).message}). ` +
          `Pages will fall back to filesystem reads, which fail on edge runtimes.`,
      );
    }
  }
  if (!options.skipLayoutCheck) {
    try {
      checkLayoutImport(options.outFile ?? 'lib/doks-content.gen.ts');
    } catch {
      // Linter must never break the build. Swallow.
    }
  }
  return config;
}
