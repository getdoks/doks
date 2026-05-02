// Runtime content cache. Populated at module-load time by the generated
// `lib/doks-content.gen.ts` (which is produced by `doks build:content`).
//
// The data layer (`lib/docs.ts`) and `DocPage` consult this cache first.
// If it is empty (no consumer-side registration ran), they fall back to
// the filesystem walker — keeping legacy 0.2.x consumers working without
// any code change. Cloudflare Workers cannot read `content/docs/`, so the
// bundled path is the one that lets edge runtimes serve doc pages.
//
// Schema versions:
// - 1 (0.3.0–0.3.2): docs[*].raw is the full MDX source. DocPage compiles
//   it at request time via next-mdx-remote/rsc → uses `new Function()`,
//   which Cloudflare Workers block at the V8 isolate level (EvalError:
//   "Code generation from strings disallowed").
// - 2 (0.3.3+): docs[*].Component is the precompiled React component
//   produced by @mdx-js/mdx at build time. No request-time compilation,
//   no eval. `raw` is still emitted for `<CopyPage>` and TOC extraction
//   but is never fed back into a compiler.

import type { DocFrontmatter } from '../lib/docs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactComponent = any;

export interface BundledDoc {
  /** Slug parts after `/docs`. Empty for the root index. */
  slug: string[];
  /** Full URL path under the docs route. */
  href: string;
  /** Parsed YAML frontmatter. */
  frontmatter: DocFrontmatter;
  /** The full MDX file content, including frontmatter. Used by `<CopyPage>` and TOC extraction. */
  raw: string;
  /**
   * Schema 2+: the precompiled React component for this doc. Imported
   * statically by the generated `lib/doks-content.gen.ts`. When
   * present, `DocPage` renders it directly (no MDX compilation at
   * request time, no `eval` / `new Function`, edge-runtime safe).
   */
  Component?: ReactComponent;
  /** Original absolute file path at build time. Useful for debug logs only. Do NOT read from it at runtime. */
  filePath?: string;
}

/** Per-node metadata read from `content/docs/_meta.json`. */
export interface BundledRootMetaEntry {
  label?: string;
  order?: number;
  collapsed?: boolean;
  hidden?: boolean;
}

export interface ContentMap {
  /** Schema version. Bumped when the generator output shape changes. */
  schemaVersion: number;
  docs: BundledDoc[];
  rootMeta: Record<string, BundledRootMetaEntry>;
}

export const CONTENT_SCHEMA_VERSION = 2;
/** Lowest schema version this runtime can read without warning. */
export const MIN_COMPATIBLE_SCHEMA_VERSION = 1;

let _bundled: ContentMap | null = null;

export function setContentMap(map: ContentMap): void {
  if (
    map.schemaVersion < MIN_COMPATIBLE_SCHEMA_VERSION ||
    map.schemaVersion > CONTENT_SCHEMA_VERSION
  ) {
    console.warn(
      `[doks] bundled content schema mismatch (got ${map.schemaVersion}, ` +
        `expected ${CONTENT_SCHEMA_VERSION}). Re-run \`doks build:content\`.`,
    );
  }
  if (map.schemaVersion < CONTENT_SCHEMA_VERSION) {
    console.warn(
      `[doks] bundled content was generated with an older schema ` +
        `(${map.schemaVersion} < ${CONTENT_SCHEMA_VERSION}). Doc pages will ` +
        `still render on Node, but edge runtimes (Cloudflare Workers) will ` +
        `throw "Code generation from strings disallowed" because MDX has to ` +
        `compile at request time. Re-run \`doks build:content\` to upgrade.`,
    );
  }
  _bundled = map;
}

export function getBundledMap(): ContentMap | null {
  return _bundled;
}

export function clearContentMap(): void {
  _bundled = null;
}
