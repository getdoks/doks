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
export { getDb, initSchema, resetTables, insertChunkBatch, vectorSearch }
  from './lib/db';

// Config types (consumers implement)
export type { SiteConfig } from './types/SiteConfig';
