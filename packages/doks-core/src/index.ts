// Public API. Anything not exported here is internal and may change.

// Pages
export { default as DocPage, generateStaticParams, generateMetadata }
  from './pages/docPage';
export { default as NotFoundPage, metadata as notFoundMetadata }
  from './pages/notFoundPage';
export { default as ErrorPage } from './pages/errorPage';
export { default as GlobalErrorPage } from './pages/globalErrorPage';

// Layout primitives
export { default as DocsShell } from './components/DocsShell';
export { default as Header } from './components/Header';
export { default as LeftSidebar } from './components/LeftSidebar';
export { default as RightRail } from './components/RightRail';
export { default as Spotlight } from './components/Spotlight';
export type { SpotlightDoc } from './components/Spotlight';

// Default config (for tests / standalone rendering)
export { defaultSiteConfig } from './lib/defaultConfig';

// MDX components (re-exported as a map for consumer to spread into MDX provider)
export { mdxComponents } from './mdx-components';

// Data layer
export { getAllDocs, getDocBySlug, buildDocTree, getDocNeighbors, extractToc }
  from './lib/docs';
export type { DocMeta, DocNode, DocFrontmatter, TocItem, CategoryMeta } from './lib/docs';
export { extractAllChunks } from './lib/chunks';
export { embed, embedOne, hasVoyageKey, EMBED_DIM, EMBED_MODEL } from './lib/embed';

// Config types (consumers implement)
export type { SiteConfig } from './types/SiteConfig';

// Vector-store contract (RFC 0001). Concrete adapters live under
// `doks-core/adapters/<name>` (e.g. `doks-core/adapters/sqlite`) and are
// wired by the consumer's `lib/doks.config.ts`. The top-level barrel
// never pulls a backend, so importing `doks-core` from edge runtimes is
// safe.
export type { ChunkRow, SearchResult, VectorStore } from './types/VectorStore';
export { createSearchHandler } from './api/searchRoute';
export type { SearchHandler } from './api/searchRoute';

// `runIngest` is intentionally NOT re-exported from the top-level barrel.
// It transitively imports the SQLite adapter (via the loadConsumerStore
// fallback) which would drag `better-sqlite3` into every consumer bundle,
// including edge-runtime ones. Import it from the subpath when needed:
//
//   import { runIngest } from 'doks-core/scripts/ingest';
//
// In practice consumers don't need it; they invoke ingest via the CLI
// (`tsx node_modules/doks-core/dist/scripts/ingest.js`).
