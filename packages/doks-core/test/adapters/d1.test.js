// Adapter contract tests: D1. D1 isn't accessible from plain Node, so
// the tests run against a minimal in-memory mock that implements the same
// `D1Database` interface the adapter needs. Verifies the brute-force
// cosine + importance rerank produces the same shape as SQLite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createD1Store } from '../../dist/adapters/d1/index.js';

// ---------------------------------------------------------------
// In-memory D1 mock. Just enough surface for the adapter to work.
// ---------------------------------------------------------------

function createD1Mock() {
  let table = null; // null = no table yet
  return {
    prepare(query) {
      return makeStmt(this, query, []);
    },
    async batch(stmts) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
    async exec(query) {
      const q = query.trim().toLowerCase();
      if (q.startsWith('drop table')) {
        table = null;
      } else if (q.startsWith('create table')) {
        table = [];
      }
    },
    _table: () => table,
    _setTable: (t) => {
      table = t;
    },
  };
  function makeStmt(db, query, bindings) {
    return {
      bind(...values) {
        return makeStmt(db, query, [...bindings, ...values]);
      },
      async run() {
        const q = query.trim().toLowerCase();
        if (q.startsWith('insert')) {
          const t = db._table();
          if (!t) throw new Error('no table');
          const row = {
            chunk_id: bindings[0],
            page_href: bindings[1],
            page_title: bindings[2],
            heading: bindings[3],
            category: bindings[4],
            importance: bindings[5],
            tags: bindings[6],
            text: bindings[7],
            embedding: bindings[8],
          };
          // INSERT OR REPLACE — drop any existing row with same chunk_id
          const filtered = t.filter((r) => r.chunk_id !== row.chunk_id);
          filtered.push(row);
          db._setTable(filtered);
        }
      },
      async all() {
        const t = db._table();
        if (!t) return { results: [] };
        return { results: t.slice() };
      },
      async first() {
        const t = db._table();
        return t && t.length ? t[0] : null;
      },
    };
  }
}

const FIXTURE = [
  {
    chunkId: 'a',
    pageHref: '/docs/auth',
    pageTitle: 'Authentication',
    heading: 'JWT issuance',
    category: 'core-concepts',
    importance: 0.9,
    tags: ['jwt', 'auth'],
    text: 'JWTs are short-lived and signed with EdDSA.',
    embedding: vec([1, 0, 0]),
  },
  {
    chunkId: 'b',
    pageHref: '/docs/chunks',
    pageTitle: 'Chunks',
    heading: 'Sizing',
    category: 'core-concepts',
    importance: 0.5,
    tags: ['sizing'],
    text: 'Aim for 150 to 500 words per chunk.',
    embedding: vec([0, 1, 0]),
  },
  {
    chunkId: 'c',
    pageHref: '/docs/themes',
    pageTitle: 'Themes',
    heading: 'Tokens',
    category: 'reference',
    importance: 0.3,
    tags: ['css', 'tokens'],
    text: 'CSS variables on data-theme blocks.',
    embedding: vec([0, 0, 1]),
  },
];

function vec(seed) {
  const out = new Array(512).fill(0);
  for (let i = 0; i < seed.length && i < 512; i++) out[i] = seed[i];
  return out;
}

test('d1: reset → upsertBatch → search round-trip', async () => {
  const db = createD1Mock();
  const store = createD1Store(db);
  await store.reset();
  await store.upsertBatch(FIXTURE);

  const results = await store.search(vec([1, 0, 0]), 5);
  assert.equal(results.length, 3, 'returns all 3 fixtures');
  assert.equal(results[0].chunkId, 'a', 'closest to query is "a"');
  assert.ok(results[0].score >= results[1].score, 'sorted by score');
  assert.equal(results[0].heading, 'JWT issuance', 'metadata round-trips');
  assert.deepEqual(results[0].tags, ['jwt', 'auth'], 'tags JSON-decoded');
});

test('d1: importance reranks ties', async () => {
  const db = createD1Mock();
  const store = createD1Store(db, { importanceWeight: 0.5 });
  await store.reset();
  await store.upsertBatch([
    { ...FIXTURE[0], chunkId: 'high', importance: 0.95 },
    { ...FIXTURE[0], chunkId: 'low', importance: 0.05 },
  ]);

  const results = await store.search(vec([1, 0, 0]), 5);
  assert.equal(results[0].chunkId, 'high', 'high-importance wins ties');
});

test('d1: upsert overwrites existing chunkId', async () => {
  const db = createD1Mock();
  const store = createD1Store(db);
  await store.reset();
  await store.upsertBatch([FIXTURE[0]]);
  await store.upsertBatch([{ ...FIXTURE[0], heading: 'Updated heading' }]);

  const results = await store.search(vec([1, 0, 0]), 5);
  assert.equal(results.length, 1);
  assert.equal(results[0].heading, 'Updated heading');
});

test('d1: empty store returns empty array', async () => {
  const db = createD1Mock();
  const store = createD1Store(db);
  await store.reset();
  const results = await store.search(vec([1, 0, 0]), 5);
  assert.deepEqual(results, []);
});

test('d1: distance field semantics match SQLite (1 - cosine_sim)', async () => {
  const db = createD1Mock();
  const store = createD1Store(db);
  await store.reset();
  await store.upsertBatch(FIXTURE);

  const results = await store.search(vec([1, 0, 0]), 5);
  // Closest match should have distance ~0; orthogonal ones ~1.
  assert.ok(results[0].distance < 0.01, 'closest distance ~0');
  // Find the orthogonal one ("b" or "c"); both have distance close to 1.
  const farther = results.find((r) => r.chunkId !== 'a');
  assert.ok(farther.distance > 0.5, 'orthogonal distance > 0.5');
});
