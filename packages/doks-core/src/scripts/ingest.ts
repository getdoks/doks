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

import { existsSync } from 'node:fs';
import { join } from 'node:path';

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
  if (!store) {
    // No config wired yet. Doc pages still render via the bundled-content
    // runtime (`lib/doks-content.gen.ts`) — only the search index will be
    // empty until a vector store is configured. Exit 0 so this doesn't
    // break CI / `npm run dev` for users who haven't picked an adapter
    // yet.
    console.log(
      [
        '',
        'doks: skipping ingest — no `lib/doks.config.{ts,js,mjs}` found.',
        '',
        'Doc pages will still render from `lib/doks-content.gen.ts` (the',
        'build-time content snapshot). Search results will be empty until',
        'a vector store is configured.',
        '',
        'To wire one, run:',
        '  npx doks upgrade        # bumps doks-core and writes lib/doks.config.ts',
        '',
        'Or create it by hand. SQLite (the default for Node hosts):',
        '  // lib/doks.config.ts',
        '  import { createSqliteStore } from "doks-core/adapters/sqlite";',
        '  import type { VectorStore } from "doks-core";',
        '  export const vectorStore: VectorStore = createSqliteStore({ path: "data/docs.db" });',
        '',
      ].join('\n'),
    );
    return;
  }
  await runIngest(store);
}

async function loadConsumerStore(): Promise<VectorStore | null> {
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
  const cwd = process.cwd();
  const existing = tries.filter((rel) => existsSync(join(cwd, rel)));

  // Friendly path: nothing exists at all. Caller decides whether to exit
  // 0 or proceed; we don't want to crash builds for users who haven't
  // picked an adapter.
  if (existing.length === 0) return null;

  const errors: { path: string; err: unknown }[] = [];
  for (const rel of existing) {
    const url = `${cwd.replace(/\\/g, '/')}/${rel}`;
    try {
      const mod = await import(/* @vite-ignore */ url);
      if (mod.vectorStore) return mod.vectorStore as VectorStore;
      errors.push({ path: rel, err: new Error('no `vectorStore` export') });
    } catch (err) {
      errors.push({ path: rel, err });
    }
  }

  // Files exist but couldn't be loaded — that's a real problem. Surface
  // the original error so the user can fix it.
  console.error(
    [
      '',
      'doks: a `lib/doks.config.{ts,js,mjs}` file exists but does not',
      'export a usable `vectorStore`.',
      '',
      'Tried:',
      ...existing.map((p) => `  - ${p}`),
      '',
      'Each candidate must `export const vectorStore = ...;`.',
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
