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
}

let _generated = false;

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
  return config;
}
