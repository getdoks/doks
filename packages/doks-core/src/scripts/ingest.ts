// Ingest: walk content/docs, extract chunks, embed, write to sqlite-vec.
// Run: npm run ingest
//
// Uses Voyage AI when VOYAGE_API_KEY is set (model voyage-3-lite, 512-dim).
// Otherwise uses a deterministic hash fallback so the pipeline runs without
// a key. Useful for first-run sanity checks, not for real retrieval.

import { extractAllChunks, type ExtractedChunk } from '../lib/chunks';
import { embed, EMBED_DIM, EMBED_MODEL, hasVoyageKey } from '../lib/embed';
import { getDb, resetTables, insertChunkBatch } from '../lib/db';

const BATCH_SIZE = 32;

function chunkText(c: ExtractedChunk): string {
  // Embedding input: title context + heading + body. Helps the embedder
  // disambiguate similar bodies that live on different pages.
  return `# ${c.pageTitle}\n## ${c.heading}\n\n${c.text}`;
}

async function main() {
  console.log('▸ doks ingest');
  console.log(
    `  embedder: ${hasVoyageKey() ? `voyage (${EMBED_MODEL}, ${EMBED_DIM}d)` : `FALLBACK hash (${EMBED_DIM}d). Set VOYAGE_API_KEY for real embeddings`}`,
  );

  const chunks = extractAllChunks();
  console.log(`  found ${chunks.length} chunks across docs`);
  if (!chunks.length) {
    console.log('  nothing to ingest. exiting.');
    return;
  }

  const db = getDb();
  resetTables(db);

  let done = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(chunkText);
    const embeddings = await embed(texts, 'document');

    insertChunkBatch(
      db,
      batch.map((c, j) => ({
        chunk_id: c.chunkId,
        page_href: c.pageHref,
        page_title: c.pageTitle,
        heading: c.heading,
        category: c.category ?? null,
        importance: c.importance,
        tags: c.tags,
        text: c.text,
        embedding: embeddings[j],
      })),
    );

    done += batch.length;
    process.stdout.write(`  embedded ${done}/${chunks.length}\r`);
  }
  process.stdout.write('\n');
  console.log('  done.');
}

main().catch((err) => {
  console.error('ingest failed:', err);
  process.exit(1);
});
