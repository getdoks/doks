// D1 HTTP adapter. Same `VectorStore` contract as `createD1Store` but
// talks to Cloudflare's REST API over fetch instead of relying on the
// in-Worker `D1Database` binding. Use this for Node-side ingest into
// remote D1, where `getCloudflareContext()` isn't reachable.
//
// ```ts
// // lib/doks.config.ingest.ts
// import { createD1HttpStore } from "doks-core/adapters/d1/http";
// import type { VectorStore } from "doks-core";
//
// export const vectorStore: VectorStore = createD1HttpStore({
//   accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
//   databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
//   apiToken: process.env.CLOUDFLARE_API_TOKEN!,
// });
// ```
//
// Then run ingest pointed at the alternate config:
//
//   DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest

import type {
  ChunkRow,
  SearchResult,
  VectorStore,
} from '../../types/VectorStore';

export interface D1HttpStoreOptions {
  /** Cloudflare account ID (find under Workers & Pages → Overview). */
  accountId: string;
  /** D1 database ID (printed by `wrangler d1 create`). */
  databaseId: string;
  /**
   * Cloudflare API token with **Account → D1 → Edit** permission.
   * Create at https://dash.cloudflare.com/profile/api-tokens.
   */
  apiToken: string;
  /** Importance-boost weight for reranking. Default `0.15`. */
  importanceWeight?: number;
  /**
   * How many rows to send per batch. Cloudflare's HTTP endpoint accepts
   * batched statements but caps per-call payload size; 25 is a safe
   * default for the typical chunk row (text + 512-dim float embedding).
   */
  batchSize?: number;
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
  embedding: string; // base64 in the HTTP response
}

interface D1Response<T = unknown> {
  result?: { results?: T[] }[];
  errors?: { code: number; message: string }[];
  success: boolean;
}

export function createD1HttpStore(
  options: D1HttpStoreOptions,
): VectorStore {
  if (!options.accountId || !options.databaseId || !options.apiToken) {
    throw new Error(
      'createD1HttpStore: accountId, databaseId, and apiToken are required',
    );
  }
  const importanceWeight = options.importanceWeight ?? 0.15;
  const batchSize = options.batchSize ?? 25;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/d1/database/${options.databaseId}/query`;

  async function send(
    sql: string,
    params: unknown[] = [],
  ): Promise<D1Response<ChunkRowD1>> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    const json = (await res.json()) as D1Response<ChunkRowD1>;
    if (!json.success) {
      const msgs = (json.errors ?? [])
        .map((e) => `${e.code}: ${e.message}`)
        .join('; ');
      throw new Error(`D1 HTTP ${res.status}: ${msgs || 'unknown error'}`);
    }
    return json;
  }

  return {
    async reset() {
      await send(`DROP TABLE IF EXISTS chunks`);
      await send(
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
      // Cloudflare's /query endpoint runs one SQL statement per call,
      // so we pack multiple INSERTs into a single statement using
      // (?, ?, ?, ...), (?, ?, ?, ...) tuples. That keeps round-trips
      // proportional to batchSize, not row count.
      for (let i = 0; i < rows.length; i += batchSize) {
        const slice = rows.slice(i, i + batchSize);
        const placeholders = slice
          .map(() => '(?,?,?,?,?,?,?,?,?)')
          .join(',');
        const sql = `INSERT OR REPLACE INTO chunks
          (chunk_id, page_href, page_title, heading, category,
           importance, tags, text, embedding)
          VALUES ${placeholders}`;
        const params: unknown[] = [];
        for (const r of slice) {
          params.push(
            r.chunkId,
            r.pageHref,
            r.pageTitle,
            r.heading,
            r.category,
            r.importance,
            JSON.stringify(r.tags),
            r.text,
            float32ToBase64(r.embedding),
          );
        }
        await send(sql, params);
      }
    },

    async search(
      queryEmbedding: number[],
      topK: number,
    ): Promise<SearchResult[]> {
      const json = await send(`SELECT * FROM chunks`);
      const rows = json.result?.[0]?.results ?? [];
      if (!rows.length) return [];

      const q = queryEmbedding;
      const qNorm = vectorNorm(q);

      return rows
        .map((r): SearchResult => {
          const emb = base64ToFloat32(r.embedding);
          const sim = cosineSim(q, emb, qNorm);
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
// Float32 ↔ base64 (D1 HTTP encodes BLOBs as base64 strings)
// ---------------------------------------------------------------

function float32ToBase64(vec: number[]): string {
  const buf = new Float32Array(vec).buffer;
  return Buffer.from(buf).toString('base64');
}

function base64ToFloat32(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64');
  // Copy to ensure proper alignment for Float32Array.
  const aligned = new Uint8Array(buf.byteLength);
  aligned.set(buf);
  return new Float32Array(aligned.buffer);
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
