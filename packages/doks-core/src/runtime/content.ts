// Runtime content cache. Populated at module-load time by the generated
// `lib/doks-content.gen.ts` (which is produced by `doks build:content`).
//
// The data layer (`lib/docs.ts`) and `DocPage` consult this cache first.
// If it is empty (no consumer-side registration ran), they fall back to
// the filesystem walker — keeping legacy 0.2.x consumers working without
// any code change. Cloudflare Workers cannot read `content/docs/`, so the
// bundled path is the one that lets edge runtimes serve doc pages.

import type { DocFrontmatter } from '../lib/docs';

export interface BundledDoc {
  /** Slug parts after `/docs`. Empty for the root index. */
  slug: string[];
  /** Full URL path under the docs route. */
  href: string;
  /** Parsed YAML frontmatter. */
  frontmatter: DocFrontmatter;
  /** The full MDX file content, including frontmatter. Same shape `fs.readFileSync` would return. */
  raw: string;
  /** Original absolute file path at build time. Useful for debug logs only — do NOT read from it at runtime. */
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

export const CONTENT_SCHEMA_VERSION = 1;

let _bundled: ContentMap | null = null;

export function setContentMap(map: ContentMap): void {
  if (map.schemaVersion !== CONTENT_SCHEMA_VERSION) {
    console.warn(
      `[doks] bundled content schema mismatch (got ${map.schemaVersion}, ` +
        `expected ${CONTENT_SCHEMA_VERSION}). Re-run \`doks build:content\`.`,
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
