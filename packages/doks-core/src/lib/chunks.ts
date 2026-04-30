// Extract retrievable chunks from an MDX file.
//
// Two strategies, in order of preference:
//   1. Explicit <Chunk id="..." importance={...} tags={[...]}>...body...</Chunk>
//      blocks. The author marks exactly what should be retrievable.
//   2. Heading-based fallback. If a file has no <Chunk> tags, split on H2/H3
//      so the page is still indexable.
//
// Each chunk is returned as a plain text string plus metadata. Markdown is
// kept (not rendered). Embedders handle short markdown well.

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { DOCS_DIR, getAllDocs, type DocMeta } from './docs';

export interface ExtractedChunk {
  pageHref: string;          // /docs/core-concepts/chunks
  pageTitle: string;         // "Chunks"
  pageChunkId: string;       // frontmatter.chunk_id, page-level
  chunkId: string;           // unique within DB: pageChunkId + ":" + localId
  localId: string;           // <Chunk id> or slugged heading
  heading: string;           // human-readable section title
  importance: number;
  tags: string[];
  text: string;              // body content (markdown preserved)
  category?: string;
  filePath: string;
}

const CHUNK_OPEN_RE =
  /<Chunk\s+id=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/Chunk>/g;

// Range pairs of inline-code spans (single backticks) so the chunk detector
// can skip <Chunk> mentions that appear in prose like `<Chunk id="x">`.
function inlineCodeRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  // Single-backtick spans, no nested backticks. Stop at newlines so an
  // unmatched backtick never swallows the rest of the file.
  const re = /`[^`\n]+`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

function inRanges(pos: number, ranges: { start: number; end: number }[]): boolean {
  for (const r of ranges) {
    if (pos >= r.start && pos < r.end) return true;
  }
  return false;
}

function parseAttrs(attrStr: string): {
  importance: number;
  tags: string[];
} {
  let importance = 0.5;
  let tags: string[] = [];

  const impMatch = attrStr.match(/importance=\{([^}]+)\}/);
  if (impMatch) {
    const n = Number(impMatch[1]);
    if (!Number.isNaN(n)) importance = n;
  }

  const tagsMatch = attrStr.match(/tags=\{(\[[^\]]*\])\}/);
  if (tagsMatch) {
    try {
      // Loose JSON: convert single quotes to double quotes
      const arr = JSON.parse(tagsMatch[1].replace(/'/g, '"')) as unknown;
      if (Array.isArray(arr)) tags = arr.map((t) => String(t));
    } catch {
      /* ignore malformed tags */
    }
  }

  return { importance, tags };
}

function stripHeadingPrefix(line: string): string {
  return line.replace(/^#{1,6}\s+/, '').trim();
}

function chunkBodyToText(body: string): { heading: string; text: string } {
  // The opening <Chunk> sometimes wraps a heading text node. Pull it out.
  // Body is the raw inner content between <Chunk>...</Chunk>.
  const trimmed = body.trim();
  // If the body itself is a single line of plain text (e.g. heading wrapper),
  // treat the line as the heading and there's no body.
  if (!trimmed.includes('\n')) {
    return { heading: trimmed, text: trimmed };
  }
  const firstLine = trimmed.split('\n', 1)[0];
  return {
    heading: stripHeadingPrefix(firstLine).slice(0, 120),
    text: trimmed,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function extractWithChunkTags(
  doc: DocMeta,
  body: string,
): ExtractedChunk[] {
  const out: ExtractedChunk[] = [];
  const fm = doc.frontmatter;
  const pageChunkId = fm.chunk_id ?? slugify(fm.title) ?? doc.slug.join('-');

  // Match block-level <Chunk>…</Chunk>. Some authors also use a heading
  // wrapper like `### <Chunk id="x">Title</Chunk>` followed by prose; in that
  // case the text after the closing </Chunk> until the next <Chunk> or
  // heading is part of the same chunk.
  // ids must be kebab-style identifiers. A stricter pattern than `[^"']+`
  // rules out placeholders like id="..." that show up in prose examples.
  const openRe = /<Chunk\s+id=["']([a-zA-Z][a-zA-Z0-9_-]*)["']([^>]*)>/g;
  const closeRe = /<\/Chunk>/g;
  const codeRanges = inlineCodeRanges(body);

  let m: RegExpExecArray | null;
  const openings: { id: string; attrs: string; openEnd: number; openStart: number }[] = [];
  while ((m = openRe.exec(body)) !== null) {
    // Skip <Chunk> mentions that sit inside inline-code spans.
    if (inRanges(m.index, codeRanges)) continue;
    openings.push({
      id: m[1],
      attrs: m[2],
      openStart: m.index,
      openEnd: m.index + m[0].length,
    });
  }
  if (openings.length === 0) return [];

  const closes: number[] = [];
  while ((m = closeRe.exec(body)) !== null) {
    if (inRanges(m.index, codeRanges)) continue;
    closes.push(m.index);
  }

  // Pair each opening with its next close, then extend the chunk's "text"
  // up to the next opening (or EOF) so trailing prose is included.
  for (let i = 0; i < openings.length; i++) {
    const open = openings[i];
    const nextOpen = openings[i + 1]?.openStart ?? body.length;
    const close = closes.find((c) => c > open.openEnd) ?? open.openEnd;

    const headingText = body.slice(open.openEnd, close).trim();
    const trailingText = body.slice(close + '</Chunk>'.length, nextOpen).trim();
    const text = [headingText, trailingText].filter(Boolean).join('\n\n');

    const heading = headingText
      ? stripHeadingPrefix(headingText).slice(0, 120)
      : open.id;

    const { importance, tags } = parseAttrs(open.attrs);

    out.push({
      pageHref: doc.href,
      pageTitle: fm.title,
      pageChunkId,
      chunkId: `${pageChunkId}:${open.id}`,
      localId: open.id,
      heading,
      importance,
      tags,
      text,
      category: fm.category,
      filePath: doc.filePath,
    });
  }

  return out;
}

function extractByHeadings(doc: DocMeta, body: string): ExtractedChunk[] {
  const fm = doc.frontmatter;
  const pageChunkId = fm.chunk_id ?? slugify(fm.title) ?? doc.slug.join('-');
  const lines = body.split('\n');

  const sections: { heading: string; lines: string[] }[] = [
    { heading: fm.title, lines: [] },
  ];

  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    if (!inFence && /^##{1,2}\s+/.test(line)) {
      sections.push({ heading: stripHeadingPrefix(line), lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  return sections
    .map((s) => ({ heading: s.heading, text: s.lines.join('\n').trim() }))
    .filter((s) => s.text.length > 40)
    .map((s, i) => ({
      pageHref: doc.href,
      pageTitle: fm.title,
      pageChunkId,
      chunkId: `${pageChunkId}:${slugify(s.heading) || `section-${i}`}`,
      localId: slugify(s.heading) || `section-${i}`,
      heading: s.heading,
      importance: fm.vector_metadata?.importance ?? 0.5,
      tags: fm.tags ?? [],
      text: s.text,
      category: fm.category,
      filePath: doc.filePath,
    }));
}

export function extractChunksFromDoc(doc: DocMeta): ExtractedChunk[] {
  const raw = fs.readFileSync(doc.filePath, 'utf8');
  const { content } = matter(raw);

  // Strip MDX-only wrapper components that don't carry retrievable prose
  // (Hero, QJump, etc). They're navigation, not content.
  // Also strip fenced code blocks BEFORE chunk extraction so any <Chunk>
  // example shown inside a code sample isn't mistaken for a real chunk.
  const stripped = content
    .replace(/<Hero[\s\S]*?<\/Hero>/g, '')
    .replace(/<QJump[\s\S]*?<\/QJump>/g, '')
    .replace(/```[\s\S]*?```/g, '');

  const seen = new Set<string>();
  const dedup = (chunks: ExtractedChunk[]): ExtractedChunk[] => {
    const out: ExtractedChunk[] = [];
    for (const c of chunks) {
      let key = c.chunkId;
      let n = 2;
      while (seen.has(key)) {
        key = `${c.chunkId}-${n++}`;
      }
      seen.add(key);
      out.push({ ...c, chunkId: key });
    }
    return out;
  };

  const tagged = extractWithChunkTags(doc, stripped);
  if (tagged.length > 0) return dedup(tagged);
  return dedup(extractByHeadings(doc, stripped));
}

export function extractAllChunks(): ExtractedChunk[] {
  const docs = getAllDocs();
  const all: ExtractedChunk[] = [];
  for (const doc of docs) {
    all.push(...extractChunksFromDoc(doc));
  }
  return all;
}

// Re-export for the ingest script
export { DOCS_DIR };
export const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'docs.db');
