// SQLite + sqlite-vec adapter for `VectorStore`. The default backend for
// local dev and Node-runtime hosts. Lives in its own subpath so importing
// `doks-core` from an edge runtime never pulls `better-sqlite3` through
// the consumer's bundler — only consumers that wire `createSqliteStore`
// in their `lib/doks.config.ts` get the native dependency.

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import fs from 'node:fs';
import { EMBED_DIM } from '../../lib/embed';
import type {
  ChunkRow,
  SearchResult,
  VectorStore,
} from '../../types/VectorStore';

export interface SqliteStoreOptions {
  /**
   * Path to the SQLite file. Resolved relative to `process.cwd()` if
   * relative. Default: `data/docs.db`.
   */
  path?: string;
  /**
   * Importance-boost weight applied during search reranking. Higher
   * values surface author-flagged "high importance" chunks above
   * marginally-closer matches. Default: `0.15`.
   */
  importanceWeight?: number;
  /**
   * Dimensionality of the stored embeddings. Must match the embedder's
   * output. Default: matches `doks-core/lib/embed`'s `EMBED_DIM`.
   */
  embedDim?: number;
}

interface ChunkRowDb {
  id: number;
  chunk_id: string;
  page_href: string;
  page_title: string;
  heading: string;
  category: string | null;
  importance: number;
  tags: string;
  text: string;
}

interface VecRow {
  rowid: number;
  distance: number;
}

/**
 * Build a SQLite-backed `VectorStore`. Lazy: the DB file is created on
 * first method call, not at factory time, so this is safe to invoke at
 * module load (including in environments where the filesystem isn't
 * available yet).
 *
 * ```ts
 * import { createSqliteStore } from 'doks-core/adapters/sqlite';
 * export const vectorStore = createSqliteStore({ path: 'data/docs.db' });
 * ```
 */
export function createSqliteStore(
  options: SqliteStoreOptions = {},
): VectorStore {
  const dbPath = options.path
    ? path.isAbsolute(options.path)
      ? options.path
      : path.join(process.cwd(), options.path)
    : path.join(process.cwd(), 'data', 'docs.db');

  const importanceWeight = options.importanceWeight ?? 0.15;
  const embedDim = options.embedDim ?? EMBED_DIM;

  let _db: Database.Database | null = null;

  function getDb(): Database.Database {
    if (_db) return _db;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    sqliteVec.load(db);
    initSchema(db, embedDim);
    _db = db;
    return db;
  }

  return {
    async reset() {
      const db = getDb();
      db.exec(`DROP TABLE IF EXISTS chunks_vec;`);
      db.exec(`DROP TABLE IF EXISTS chunks;`);
      initSchema(db, embedDim);
    },

    async upsertBatch(rows: ChunkRow[]): Promise<void> {
      if (rows.length === 0) return;
      const db = getDb();

      const insertChunk = db.prepare(`
        INSERT INTO chunks
          (chunk_id, page_href, page_title, heading, category, importance, tags, text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(chunk_id) DO UPDATE SET
          page_href  = excluded.page_href,
          page_title = excluded.page_title,
          heading    = excluded.heading,
          category   = excluded.category,
          importance = excluded.importance,
          tags       = excluded.tags,
          text       = excluded.text
      `);
      const insertVec = db.prepare(
        `INSERT INTO chunks_vec(rowid, embedding) VALUES (?, ?)`,
      );
      const findId = db.prepare(
        `SELECT id FROM chunks WHERE chunk_id = ?`,
      );
      const deleteVec = db.prepare(
        `DELETE FROM chunks_vec WHERE rowid = ?`,
      );

      const tx = db.transaction(() => {
        for (const r of rows) {
          insertChunk.run(
            r.chunkId,
            r.pageHref,
            r.pageTitle,
            r.heading,
            r.category,
            r.importance,
            JSON.stringify(r.tags),
            r.text,
          );
          const row = findId.get(r.chunkId) as { id: number };
          // Re-write the vec row in case this was an update — the
          // virtual table has no ON CONFLICT support.
          deleteVec.run(BigInt(row.id));
          const buf = Buffer.from(new Float32Array(r.embedding).buffer);
          insertVec.run(BigInt(row.id), buf);
        }
      });
      tx();
    },

    async search(
      queryEmbedding: number[],
      topK: number,
    ): Promise<SearchResult[]> {
      const db = getDb();
      const vecBlob = new Float32Array(queryEmbedding);

      const vecRows = db
        .prepare(
          `SELECT rowid, distance FROM chunks_vec
           WHERE embedding MATCH ? AND k = ?
           ORDER BY distance`,
        )
        .all(Buffer.from(vecBlob.buffer), topK * 2) as VecRow[];

      if (vecRows.length === 0) return [];

      const ids = vecRows.map((r) => r.rowid);
      const placeholders = ids.map(() => '?').join(',');
      const meta = db
        .prepare(`SELECT * FROM chunks WHERE id IN (${placeholders})`)
        .all(...ids) as ChunkRowDb[];
      const byId = new Map(meta.map((m) => [m.id, m]));

      const merged = vecRows
        .map((v): SearchResult | null => {
          const m = byId.get(v.rowid);
          if (!m) return null;
          // Cosine distance in sqlite-vec is in [0, 2]. Convert to a
          // similarity in [0, 1] then add the importance boost.
          const sim = 1 - v.distance / 2;
          const score = sim + importanceWeight * (m.importance - 0.5);
          return {
            chunkId: m.chunk_id,
            pageHref: m.page_href,
            pageTitle: m.page_title,
            heading: m.heading,
            category: m.category,
            importance: m.importance,
            tags: JSON.parse(m.tags) as string[],
            text: m.text,
            distance: v.distance,
            score,
          };
        })
        .filter((x): x is SearchResult => x !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return merged;
    },
  };
}

function initSchema(db: Database.Database, embedDim: number): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id     TEXT UNIQUE NOT NULL,
      page_href    TEXT NOT NULL,
      page_title   TEXT NOT NULL,
      heading      TEXT NOT NULL,
      category     TEXT,
      importance   REAL NOT NULL,
      tags         TEXT NOT NULL,
      text         TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks(page_href);
  `);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      embedding float[${embedDim}]
    );
  `);
}
