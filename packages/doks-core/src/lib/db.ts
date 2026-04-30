// SQLite + sqlite-vec singleton. Used by both the ingest script and the
// /api/docs/search route. The vec0 virtual table holds the embeddings; a
// regular `chunks` table holds metadata, joined by rowid.

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import fs from 'node:fs';
import { EMBED_DIM } from './embed';

export const DB_PATH = path.join(process.cwd(), 'data', 'docs.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  sqliteVec.load(db);
  _db = db;
  return db;
}

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id     TEXT UNIQUE NOT NULL,
      page_href    TEXT NOT NULL,
      page_title   TEXT NOT NULL,
      heading      TEXT NOT NULL,
      category     TEXT,
      importance   REAL NOT NULL,
      tags         TEXT NOT NULL,        -- JSON array
      text         TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks(page_href);
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      embedding float[${EMBED_DIM}]
    );
  `);
}

export function resetTables(db: Database.Database) {
  db.exec(`DROP TABLE IF EXISTS chunks_vec;`);
  db.exec(`DROP TABLE IF EXISTS chunks;`);
  initSchema(db);
}

export interface StoredChunk {
  id: number;
  chunk_id: string;
  page_href: string;
  page_title: string;
  heading: string;
  category: string | null;
  importance: number;
  tags: string[];
  text: string;
  distance?: number;
  score?: number;
}

interface ChunkRow {
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

// k-NN search. Returns the topK nearest chunks by cosine distance, re-ranked
// by a small importance boost so author-flagged "high importance" chunks
// surface ahead of marginally-closer noise.
export function vectorSearch(
  queryEmbedding: number[],
  topK = 5,
  importanceWeight = 0.15,
): StoredChunk[] {
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
    .all(...ids) as ChunkRow[];
  const byId = new Map(meta.map((m) => [m.id, m]));

  const merged = vecRows
    .map((v): StoredChunk | null => {
      const m = byId.get(v.rowid);
      if (!m) return null;
      // Cosine distance in sqlite-vec is in [0, 2]. Convert to a similarity
      // in [0, 1] then add the importance boost.
      const sim = 1 - v.distance / 2;
      const score = sim + importanceWeight * (m.importance - 0.5);
      return {
        id: m.id,
        chunk_id: m.chunk_id,
        page_href: m.page_href,
        page_title: m.page_title,
        heading: m.heading,
        category: m.category,
        importance: m.importance,
        tags: JSON.parse(m.tags) as string[],
        text: m.text,
        distance: v.distance,
        score,
      };
    })
    .filter((x): x is StoredChunk => x !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topK);

  return merged;
}

export function insertChunkBatch(
  db: Database.Database,
  rows: {
    chunk_id: string;
    page_href: string;
    page_title: string;
    heading: string;
    category: string | null;
    importance: number;
    tags: string[];
    text: string;
    embedding: number[];
  }[],
) {
  const insertChunk = db.prepare(`
    INSERT INTO chunks
      (chunk_id, page_href, page_title, heading, category, importance, tags, text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertVec = db.prepare(
    `INSERT INTO chunks_vec(rowid, embedding) VALUES (?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const r of rows) {
      const info = insertChunk.run(
        r.chunk_id,
        r.page_href,
        r.page_title,
        r.heading,
        r.category,
        r.importance,
        JSON.stringify(r.tags),
        r.text,
      );
      // sqlite-vec's vec0 virtual table requires the rowid to be bound as a
      // true SQLite INTEGER, not a REAL. Coerce via BigInt to force the
      // integer type binding through better-sqlite3.
      const rowid = BigInt(info.lastInsertRowid as number | bigint);
      const buf = Buffer.from(new Float32Array(r.embedding).buffer);
      insertVec.run(rowid, buf);
    }
  });
  tx();
}
