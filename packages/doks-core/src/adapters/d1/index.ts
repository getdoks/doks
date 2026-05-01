// Cloudflare D1 adapter for `VectorStore`. Brute-force cosine similarity
// in JS over the result set, same importance-boost rerank as the SQLite
// adapter. Pulls zero Node-only dependencies; safe for Workers / Edge.
//
// Wire it in `lib/doks.config.ts`:
//
//   import { createD1Store } from "doks-core/adapters/d1";
//   export const vectorStore = createD1Store(globalThis.env.DB);
//
// First run? Call `await vectorStore.reset()` once (e.g. via the ingest
// script) to create the `chunks` table.

import type {
  ChunkRow,
  SearchResult,
  VectorStore,
} from '../../types/VectorStore';

/**
 * Minimal D1 surface used by this adapter. Avoids importing the full
 * `@cloudflare/workers-types` package as a dependency; consumers who use
 * the adapter typically already have those types installed via their
 * Workers project.
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(stmts: D1PreparedStatement[]): Promise<unknown>;
  exec(query: string): Promise<unknown>;
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
  first<T = unknown>(): Promise<T | null>;
}

export interface D1StoreOptions {
  /**
   * Importance-boost weight applied during reranking. Default `0.15`.
   */
  importanceWeight?: number;
}

interface ChunkRowD1 {
  chunk_id: string;
  page_href: string;
  page_title: string;
  heading: string;
  category: string | null;
  importance: number;
  tags: string;
  text: string;
  embedding: ArrayBuffer;
}

/**
 * Build a D1-backed `VectorStore`. Brute-force search; fine for tens of
 * thousands of chunks, less so for millions. For larger corpora, push
 * to a hosted vector DB.
 */
export function createD1Store(
  db: D1Database,
  options: D1StoreOptions = {},
): VectorStore {
  const importanceWeight = options.importanceWeight ?? 0.15;

  return {
    async reset() {
      await db.exec(`DROP TABLE IF EXISTS chunks`);
      await db.exec(
        `CREATE TABLE chunks (
          chunk_id   TEXT PRIMARY KEY,
          page_href  TEXT NOT NULL,
          page_title TEXT NOT NULL,
          heading    TEXT NOT NULL,
          category   TEXT,
          importance REAL NOT NULL,
          tags       TEXT NOT NULL,
          text       TEXT NOT NULL,
          embedding  BLOB NOT NULL
        )`,
      );
    },

    async upsertBatch(rows: ChunkRow[]): Promise<void> {
      if (rows.length === 0) return;

      const stmt = db.prepare(
        `INSERT OR REPLACE INTO chunks
           (chunk_id, page_href, page_title, heading, category,
            importance, tags, text, embedding)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      );

      const bound = rows.map((r) =>
        stmt.bind(
          r.chunkId,
          r.pageHref,
          r.pageTitle,
          r.heading,
          r.category,
          r.importance,
          JSON.stringify(r.tags),
          r.text,
          encodeFloat32(r.embedding),
        ),
      );
      await db.batch(bound);
    },

    async search(
      queryEmbedding: number[],
      topK: number,
    ): Promise<SearchResult[]> {
      const { results } = await db
        .prepare(`SELECT * FROM chunks`)
        .all<ChunkRowD1>();
      if (!results.length) return [];

      const q = queryEmbedding;
      const qNorm = vectorNorm(q);

      return results
        .map((r): SearchResult => {
          const emb = decodeFloat32(r.embedding);
          const sim = cosineSim(q, emb, qNorm);
          // Cosine similarity is in [-1, 1]; convert to [0, 2] distance
          // so the `distance` field semantics match the SQLite adapter.
          const distance = 1 - sim;
          const score = sim + importanceWeight * (r.importance - 0.5);
          return {
            chunkId: r.chunk_id,
            pageHref: r.page_href,
            pageTitle: r.page_title,
            heading: r.heading,
            category: r.category,
            importance: r.importance,
            tags: JSON.parse(r.tags) as string[],
            text: r.text,
            distance,
            score,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    },
  };
}

// ---------------------------------------------------------------
// Float32 helpers. ArrayBuffer ↔ number[] for D1's BLOB column.
// ---------------------------------------------------------------

function encodeFloat32(vec: number[]): ArrayBuffer {
  return new Float32Array(vec).buffer;
}

function decodeFloat32(buf: ArrayBuffer): Float32Array {
  return new Float32Array(buf);
}

function vectorNorm(v: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s) || 1;
}

function cosineSim(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  aNorm?: number,
): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let bSum = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    bSum += b[i] * b[i];
  }
  const an = aNorm ?? vectorNorm(a);
  const bn = Math.sqrt(bSum) || 1;
  return dot / (an * bn);
}
