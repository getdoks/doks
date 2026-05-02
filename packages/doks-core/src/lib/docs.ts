import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import GithubSlugger from 'github-slugger';

import { getBundledMap } from '../runtime/content';

export const DOCS_DIR = path.join(process.cwd(), 'content', 'docs');

export interface VectorMetadata {
  importance?: number;
  related_topics?: string[];
  code_languages?: string[];
  [key: string]: unknown;
}

export interface DocFrontmatter {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  chunk_id?: string;
  vector_metadata?: VectorMetadata;
  order?: number;
  icon?: string;
  badge?: { label: string; variant?: 'v' | 'new' };
  eyebrow?: string;
}

export interface DocMeta {
  slug: string[];        // ["core-concepts", "chunks"]
  href: string;          // "/docs/core-concepts/chunks"
  filePath: string;      // absolute path
  frontmatter: DocFrontmatter;
}

export interface DocNode {
  type: 'doc' | 'category';
  name: string;
  /** Optional display label. Overrides the auto-titlecased `name` in the sidebar. */
  label?: string;
  href?: string;
  order: number;
  children: DocNode[];
  meta?: DocMeta;
}

/**
 * Per-node metadata read from the central `content/docs/_meta.json`.
 * Lets authors set explicit ordering and labels for category groups
 * (and any other tree node) without depending on file alphabetisation
 * or the inherited-from-first-doc behaviour.
 *
 * Example central file (`content/docs/_meta.json`):
 *
 * ```json
 * {
 *   "overview":           { "order": 0 },
 *   "samples":            { "label": "Samples", "order": 1 },
 *   "samples/components": { "label": "Components", "order": 1 },
 *   "getting-started":    { "label": "Getting Started", "order": 2 }
 * }
 * ```
 *
 * Keys are slug paths relative to `content/docs/`. The root `index.mdx`
 * is addressable as `"overview"`. Nested categories use slash-separated
 * paths (e.g. `samples/components`).
 */
export interface CategoryMeta {
  /** Display name shown in the sidebar header. */
  label?: string;
  /** Sort position among siblings. Lower numbers come first. */
  order?: number;
  /** Initial collapsed state. Currently informational; sidebar always renders open. */
  collapsed?: boolean;
  /** Hide the entry from the sidebar. Pages still resolve. */
  hidden?: boolean;
}

/** Flat name-path → meta map for sidebar layout. */
type RootMeta = Record<string, CategoryMeta>;

let _rootMetaCache: RootMeta | null = null;

function readRootMeta(): RootMeta {
  // Bundled-content runtime: prefer the snapshot baked at build time.
  // Edge runtimes can't read `content/docs/_meta.json` at request time.
  const bundled = getBundledMap();
  if (bundled) {
    return bundled.rootMeta as RootMeta;
  }

  if (_rootMetaCache && process.env.NODE_ENV === 'production') {
    return _rootMetaCache;
  }
  const metaPath = path.join(DOCS_DIR, '_meta.json');
  if (!fs.existsSync(metaPath)) {
    _rootMetaCache = {};
    return _rootMetaCache;
  }
  try {
    _rootMetaCache = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as RootMeta;
  } catch (err) {
    console.warn(`[doks] failed to parse ${metaPath}:`, err);
    _rootMetaCache = {};
  }
  return _rootMetaCache;
}

export interface TocItem {
  depth: number;
  text: string;
  id: string;
  isChunk: boolean;
  chunkId?: string;
}

// ── File walking ─────────────────────────────────────────────
function walkMdx(dir: string, basePath: string[] = []): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMdx(full, [...basePath, entry.name]));
    } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function fileToSlug(filePath: string): string[] {
  const rel = path.relative(DOCS_DIR, filePath);
  const noExt = rel.replace(/\.(md|mdx)$/, '');
  const parts = noExt.split(path.sep);
  // index files map to their parent
  if (parts[parts.length - 1] === 'index') parts.pop();
  return parts;
}

// ── Public API ──────────────────────────────────────────────
let _cache: DocMeta[] | null = null;

export function getAllDocs(): DocMeta[] {
  // Bundled-content runtime: list comes from the build-time snapshot.
  const bundled = getBundledMap();
  if (bundled) {
    const docs = bundled.docs.map(
      (b): DocMeta => ({
        slug: b.slug,
        href: b.href,
        filePath: b.filePath ?? '',
        frontmatter: b.frontmatter,
      }),
    );
    docs.sort((a, b) => {
      const oa = a.frontmatter.order ?? 999;
      const ob = b.frontmatter.order ?? 999;
      if (oa !== ob) return oa - ob;
      return (a.frontmatter.title ?? '').localeCompare(
        b.frontmatter.title ?? '',
      );
    });
    return docs;
  }

  if (_cache && process.env.NODE_ENV === 'production') return _cache;
  const files = walkMdx(DOCS_DIR);
  const docs = files.map((filePath): DocMeta => {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(raw);
    const slug = fileToSlug(filePath);
    return {
      slug,
      href: '/docs' + (slug.length ? '/' + slug.join('/') : ''),
      filePath,
      frontmatter: data as DocFrontmatter,
    };
  });
  docs.sort((a, b) => {
    const oa = a.frontmatter.order ?? 999;
    const ob = b.frontmatter.order ?? 999;
    if (oa !== ob) return oa - ob;
    return (a.frontmatter.title ?? '').localeCompare(b.frontmatter.title ?? '');
  });
  _cache = docs;
  return docs;
}

export function getDocBySlug(slug: string[]): DocMeta | null {
  const docs = getAllDocs();
  const target = slug.join('/');
  return docs.find((d) => d.slug.join('/') === target) ?? null;
}

/**
 * Return the raw MDX source for a doc. Edge-runtime safe when the
 * bundled-content map has been registered (via `lib/doks-content.gen.ts`).
 * Falls back to `fs.readFileSync` if the bundled map is empty —
 * filesystem path is fine on Node but throws on Cloudflare Workers.
 */
export function getDocSource(slug: string[]): string | null {
  const bundled = getBundledMap();
  if (bundled) {
    const target = slug.join('/');
    const found = bundled.docs.find((d) => d.slug.join('/') === target);
    return found?.raw ?? null;
  }
  const doc = getDocBySlug(slug);
  if (!doc || !doc.filePath) return null;
  try {
    return fs.readFileSync(doc.filePath, 'utf8');
  } catch {
    return null;
  }
}

// ── Tree for left sidebar ───────────────────────────────────
export function buildDocTree(): DocNode[] {
  const docs = getAllDocs();
  const root: DocNode = { type: 'category', name: '__root__', order: 0, children: [] };

  for (const doc of docs) {
    if (doc.slug.length === 0) {
      // Root index page. Promote to a sibling at the top of the tree
      root.children.unshift({
        type: 'doc',
        name: 'overview',
        href: doc.href,
        order: doc.frontmatter.order ?? 0,
        children: [],
        meta: doc,
      });
      continue;
    }
    let cursor = root;
    for (let i = 0; i < doc.slug.length; i++) {
      const part = doc.slug[i];
      const isLeaf = i === doc.slug.length - 1;
      let child = cursor.children.find((c) => c.name === part);
      if (!child) {
        child = {
          type: isLeaf ? 'doc' : 'category',
          name: part,
          order: doc.frontmatter.order ?? 999,
          children: [],
        };
        cursor.children.push(child);
      }
      if (isLeaf) {
        child.type = 'doc';
        child.href = doc.href;
        child.meta = doc;
        child.order = doc.frontmatter.order ?? 999;
      }
      cursor = child;
    }
  }

  // Apply central _meta.json overrides. The map is keyed by slug path
  // ("samples", "samples/components", "overview" for the root index doc).
  // Categories AND top-level doc nodes can be addressed. Hidden entries are
  // dropped from the tree (their pages still resolve at their URL).
  const rootMeta = readRootMeta();
  const applyMeta = (nodes: DocNode[], slugSoFar: string[]): DocNode[] => {
    const out: DocNode[] = [];
    for (const node of nodes) {
      const key = [...slugSoFar, node.name].join('/');
      const meta = rootMeta[key];
      if (meta?.hidden) continue;
      if (meta?.label !== undefined) node.label = meta.label;
      if (meta?.order !== undefined) node.order = meta.order;
      if (node.children.length) {
        node.children = applyMeta(node.children, [...slugSoFar, node.name]);
      }
      out.push(node);
    }
    return out;
  };
  root.children = applyMeta(root.children, []);

  const sortTree = (nodes: DocNode[]) => {
    nodes.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(root.children);
  return root.children;
}

// ── Prev / Next neighbors ───────────────────────────────────
// Flatten the tree in the same order the left sidebar shows:
// top-level doc nodes interleaved with their sibling category groups,
// each category's children walked depth-first.
function flattenTreeInOrder(nodes: DocNode[]): DocMeta[] {
  const out: DocMeta[] = [];
  for (const n of nodes) {
    if (n.type === 'doc' && n.meta) {
      out.push(n.meta);
    }
    if (n.children.length) {
      out.push(...flattenTreeInOrder(n.children));
    }
  }
  return out;
}

export function getDocNeighbors(slug: string[]): {
  prev: DocMeta | null;
  next: DocMeta | null;
} {
  const flat = flattenTreeInOrder(buildDocTree());
  const target = slug.join('/');
  const idx = flat.findIndex((d) => d.slug.join('/') === target);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

// ── Right sidebar TOC ───────────────────────────────────────
// Picks up three kinds of entry, in this order on each line:
//   1. <Chunk id="...">. Author-tagged retrievable section (depth = wrapping
//      heading level, or 2 if standalone)
//   2. ##/###/#### markdown heading
//   3. <h2>/<h3>/<h4> JSX heading (with or without attributes)
//
// Inline backtick code spans are masked first so prose mentions like
// `<Chunk id="x">` or `<h2>` don't get matched as real tags.
function maskInlineCode(line: string): {
  masked: string;
  restore: (s: string) => string;
} {
  const placeholders: string[] = [];
  const masked = line.replace(/`[^`\n]+`/g, (m) => {
    const i = placeholders.length;
    placeholders.push(m);
    return `\x00${i}\x01`;
  });
  const restore = (s: string) =>
    s.replace(/\x00(\d+)\x01/g, (_, i) => placeholders[Number(i)]);
  return { masked, restore };
}

export function extractToc(raw: string): TocItem[] {
  const slugger = new GithubSlugger();
  const { content } = matter(raw);
  const lines = content.split('\n');
  const toc: TocItem[] = [];

  let inCodeFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const { masked, restore } = maskInlineCode(line);

    // 1. <Chunk id="..."> opener
    const chunkMatch = masked.match(
      /<Chunk\s+id=["']([a-zA-Z][a-zA-Z0-9_-]*)["'][^>]*>/,
    );
    if (chunkMatch) {
      const headingMatch = masked.match(/^(#{2,4})\s+/);
      // Strip Chunk wrappers + heading prefix on the masked copy, then
      // restore inline-code spans so `<Chunk>` mentions in the heading
      // text survive (e.g. `### <Chunk id="x">The \`<Chunk>\` tag</Chunk>`).
      const inner = masked
        .replace(/<Chunk\s+id=["'][^"']+["'][^>]*>/, '')
        .replace(/<\/Chunk>\s*$/, '')
        .replace(/^#{1,6}\s+/, '')
        .trim();
      const text = restore(inner) || chunkMatch[1];
      const depth = headingMatch ? headingMatch[1].length : 2;
      toc.push({
        depth,
        text,
        id: chunkMatch[1],
        isChunk: true,
        chunkId: chunkMatch[1],
      });
      continue;
    }

    // 2. Markdown ## / ### / #### heading
    const heading = masked.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (heading) {
      const depth = heading[1].length;
      const text = restore(heading[2]).replace(/<\/?[^>]+>/g, '').trim();
      const id = slugger.slug(text);
      toc.push({ depth, text, id, isChunk: false });
      continue;
    }

    // 3. JSX <h2> / <h3> / <h4> tag (full element on one line). MDX/JSX
    //    headings don't get IDs from rehype-slug, so we generate the same
    //    slug here and rely on the custom h2/h3/h4 components in the MDX
    //    components map to apply matching ids at render time.
    const jsxHeading = masked.match(/<h([234])\b[^>]*>([\s\S]*?)<\/h\1>/);
    if (jsxHeading) {
      const depth = Number(jsxHeading[1]);
      const text = restore(jsxHeading[2]).replace(/<\/?[^>]+>/g, '').trim();
      if (!text) continue;
      const id = slugger.slug(text);
      toc.push({ depth, text, id, isChunk: false });
    }
  }
  return toc;
}
