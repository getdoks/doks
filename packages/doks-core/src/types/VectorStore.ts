// Public interface for vector-store backends. The framework calls into
// this; concrete implementations live in `adapters/` and are wired up by
// the consumer's `lib/doks.config.ts`.
//
// Field names are camelCase. Adapters that talk to SQLite or other
// snake_case columns map between the two internally; consumers and the
// API route handler only ever see camelCase.

/**
 * Embedded chunk written to the store. `embedding` is the dense vector;
 * everything else is metadata used for retrieval ranking and rendering.
 */
export interface ChunkRow {
  /** Stable identifier. Author-supplied via `<Chunk id="...">`. */
  chunkId: string;
  /** URL of the page this chunk belongs to (e.g. `/docs/foo`). */
  pageHref: string;
  /** Human-readable page title from frontmatter. */
  pageTitle: string;
  /** Heading text the chunk sits under (or the chunk's own heading). */
  heading: string;
  /** Frontmatter category, or `null` for top-level pages. */
  category: string | null;
  /** Author-set retrieval importance in [0, 1]. Default 0.5. */
  importance: number;
  /** Author-set tags (frontmatter + `<Chunk tags={[...]}>`). */
  tags: string[];
  /** The embedded text. */
  text: string;
  /** Dense embedding vector. Length must match `EMBED_DIM`. */
  embedding: number[];
}

/**
 * A row returned from `VectorStore.search`. Adds distance + score on top
 * of the stored metadata. `embedding` is omitted to keep search payloads
 * small; consumers don't need it.
 */
export interface SearchResult extends Omit<ChunkRow, 'embedding'> {
  /** Cosine distance in [0, 2]. Lower is closer. */
  distance: number;
  /**
   * Final ranking score after the adapter's importance-boost rerank.
   * Higher is better. Adapters without reranking can return
   * `1 - distance / 2` (cosine similarity).
   */
  score: number;
}

/**
 * The contract every storage backend implements. Adapters live in
 * `doks-core/adapters/<name>/` and are constructed via a factory the
 * consumer calls in their `lib/doks.config.ts`:
 *
 * ```ts
 * import { createSqliteStore } from 'doks-core/adapters/sqlite';
 * export const vectorStore = createSqliteStore({ path: 'data/docs.db' });
 * ```
 *
 * The framework's search route handler and ingest script both take a
 * `VectorStore` and never touch a specific backend.
 */
export interface VectorStore {
  /**
   * k-NN search. Returns the topK nearest rows to `queryEmbedding`,
   * ranked by the adapter (typically cosine similarity plus an
   * importance boost). Empty array if the store has no rows yet.
   */
  search(queryEmbedding: number[], topK: number): Promise<SearchResult[]>;

  /**
   * Insert (or replace) a batch of chunk rows. Called by the ingest
   * script after embedding. Idempotent on `chunkId`.
   */
  upsertBatch(rows: ChunkRow[]): Promise<void>;

  /**
   * Drop and recreate the store's tables / collections / indexes.
   * Called at the start of every ingest run so renamed or deleted
   * chunks don't linger.
   */
  reset(): Promise<void>;
}
