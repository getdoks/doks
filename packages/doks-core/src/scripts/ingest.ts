// Ingest: walk content/docs, extract chunks, embed, write to a VectorStore.
//
// Two surfaces:
// - `runIngest(store)`. Programmatic API. Pass any VectorStore.
// - This module's main(). CLI wrapper. Loads `vectorStore` from the
//   consumer's `lib/doks.config.ts` and calls `runIngest()`.
//
// Embedder: Voyage AI when `VOYAGE_API_KEY` is set (model voyage-3-lite,
// 512-dim). Otherwise a deterministic hash fallback so the pipeline runs
// without a key. The fallback is fine for first-run sanity checks, not
// for real retrieval.

import { extractAllChunks, type ExtractedChunk } from '../lib/chunks';
import { embed, EMBED_DIM, EMBED_MODEL, hasVoyageKey } from '../lib/embed';
import type { VectorStore } from '../types/VectorStore';

const BATCH_SIZE = 32;

function chunkText(c: ExtractedChunk): string {
  // Embedding input: title context + heading + body. Helps the embedder
  // disambiguate similar bodies that live on different pages.
  return `# ${c.pageTitle}\n## ${c.heading}\n\n${c.text}`;
}

export interface RunIngestOptions {
  /**
   * If true, suppresses all stdout. Useful when calling from another
   * Node program that wants to stay quiet. Default: false.
   */
  silent?: boolean;
}

/**
 * Ingest the consumer's content corpus into a `VectorStore`. Reads from
 * `process.cwd()/content/docs/` (controlled by `lib/docs.ts`'s `DOCS_DIR`).
 *
 * Idempotent: every call resets the store before writing. Re-running is
 * safe and is the right thing to do after MDX changes.
 */
export async function runIngest(
  store: VectorStore,
  options: RunIngestOptions = {},
): Promise<{ chunks: number }> {
  const log = options.silent ? () => {} : (msg: string) => console.log(msg);
  const write = options.silent
    ? () => {}
    : (msg: string) => process.stdout.write(msg);

  log('▸ doks ingest');
  log(
    `  embedder: ${
      hasVoyageKey()
        ? `voyage (${EMBED_MODEL}, ${EMBED_DIM}d)`
        : `FALLBACK hash (${EMBED_DIM}d). Set VOYAGE_API_KEY for real embeddings`
    }`,
  );

  const chunks = extractAllChunks();
  log(`  found ${chunks.length} chunks across docs`);
  if (!chunks.length) {
    log('  nothing to ingest. exiting.');
    return { chunks: 0 };
  }

  await store.reset();

  let done = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(chunkText);
    const embeddings = await embed(texts, 'document');

    await store.upsertBatch(
      batch.map((c, j) => ({
        chunkId: c.chunkId,
        pageHref: c.pageHref,
        pageTitle: c.pageTitle,
        heading: c.heading,
        category: c.category ?? null,
        importance: c.importance,
        tags: c.tags,
        text: c.text,
        embedding: embeddings[j],
      })),
    );

    done += batch.length;
    write(`  embedded ${done}/${chunks.length}\r`);
  }
  write('\n');
  log('  done.');
  return { chunks: chunks.length };
}

// CLI entry point. Loads the consumer's vectorStore from
// `lib/doks.config.ts` (relative to process.cwd()).
async function main() {
  const store = await loadConsumerStore();
  await runIngest(store);
}

async function loadConsumerStore(): Promise<VectorStore> {
  // DOKS_CONFIG overrides the default search order. Useful for D1 setups
  // where the runtime config calls `getCloudflareContext()` (Worker-only)
  // and ingest needs a separate SQLite-or-D1-HTTP config:
  //
  //   DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest
  const explicit = process.env.DOKS_CONFIG;
  const tries = explicit
    ? [explicit]
    : [
        'lib/doks.config.ts',
        'lib/doks.config.js',
        'lib/doks.config.mjs',
      ];
  const errors: { path: string; err: unknown }[] = [];
  for (const rel of tries) {
    const url = `${process.cwd().replace(/\\/g, '/')}/${rel}`;
    try {
      const mod = await import(/* @vite-ignore */ url);
      if (mod.vectorStore) return mod.vectorStore as VectorStore;
    } catch (err) {
      errors.push({ path: rel, err });
    }
  }
  // No usable lib/doks.config.ts. Don't fall back to SQLite: that would
  // drag `better-sqlite3` into every consumer bundle through static
  // analysis, defeating the whole adapter split. Print a useful error
  // instead and exit.
  console.error(
    [
      '',
      'doks: ingest could not load a `vectorStore` from your project.',
      '',
      'Expected one of:',
      ...tries.map((p) => `  - ${p}`),
      '',
      'Each candidate must `export const vectorStore = ...;`.',
      '',
      'For SQLite (default):',
      `  import { createSqliteStore } from "doks-core/adapters/sqlite";`,
      `  export const vectorStore = createSqliteStore({ path: "data/docs.db" });`,
      '',
      'For D1: lib/doks.config.ts uses `getCloudflareContext()` and runs',
      'inside a Worker, not under Node. Write a separate Node-friendly',
      'config and point the ingest CLI at it:',
      '',
      '  // lib/doks.config.ingest.ts',
      '  import { createD1HttpStore } from "doks-core/adapters/d1/http";',
      '  export const vectorStore = createD1HttpStore({',
      '    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,',
      '    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,',
      '    apiToken: process.env.CLOUDFLARE_API_TOKEN!,',
      '  });',
      '',
      '  $ DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest',
      '',
      'Last error:',
      String((errors.at(-1)?.err as Error)?.message ?? 'unknown'),
      '',
    ].join('\n'),
  );
  process.exit(1);
}

// Only run main() when this file is the script entry, not when imported.
// Accept .js/.mjs/.cjs (built / published path) and .ts (tsx dev path).
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  /scripts[\\/]ingest\.[mc]?[jt]s$/.test(process.argv[1]);

if (isMain) {
  main().catch((err) => {
    console.error('ingest failed:', err);
    process.exit(1);
  });
}
