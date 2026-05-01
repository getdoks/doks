// Adapter contract tests: SQLite. Run against an in-memory-style temp DB
// so the test doesn't pollute the workspace's data/ directory.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSqliteStore } from '../../dist/adapters/sqlite/index.js';

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
  // Pad to EMBED_DIM = 512.
  const out = new Array(512).fill(0);
  for (let i = 0; i < seed.length && i < 512; i++) out[i] = seed[i];
  return out;
}

test('sqlite: reset → upsertBatch → search round-trip', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-sqlite-'));
  try {
    const store = createSqliteStore({
      path: join(dir, 'test.db'),
      embedDim: 512,
    });
    await store.reset();
    await store.upsertBatch(FIXTURE);

    const results = await store.search(vec([1, 0, 0]), 5);
    assert.equal(results.length, 3, 'returns all 3 fixtures');
    assert.equal(results[0].chunkId, 'a', 'closest to query is "a"');
    assert.ok(results[0].score >= results[1].score, 'sorted by score');
    assert.equal(results[0].heading, 'JWT issuance', 'metadata round-trips');
    assert.deepEqual(results[0].tags, ['jwt', 'auth'], 'tags JSON-decoded');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sqlite: importance reranks ties', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-sqlite-'));
  try {
    const store = createSqliteStore({
      path: join(dir, 'test.db'),
      embedDim: 512,
      importanceWeight: 0.5,
    });
    await store.reset();
    // Two chunks with identical embeddings; importance breaks the tie.
    await store.upsertBatch([
      { ...FIXTURE[0], chunkId: 'high', importance: 0.95 },
      { ...FIXTURE[0], chunkId: 'low', importance: 0.05 },
    ]);

    const results = await store.search(vec([1, 0, 0]), 5);
    assert.equal(results[0].chunkId, 'high', 'high-importance wins ties');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sqlite: upsert overwrites existing chunkId', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-sqlite-'));
  try {
    const store = createSqliteStore({
      path: join(dir, 'test.db'),
      embedDim: 512,
    });
    await store.reset();
    await store.upsertBatch([FIXTURE[0]]);
    await store.upsertBatch([
      { ...FIXTURE[0], heading: 'Updated heading' },
    ]);

    const results = await store.search(vec([1, 0, 0]), 5);
    assert.equal(results.length, 1, 'still 1 row');
    assert.equal(results[0].heading, 'Updated heading', 'value updated');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sqlite: empty store returns empty array', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-sqlite-'));
  try {
    const store = createSqliteStore({
      path: join(dir, 'test.db'),
      embedDim: 512,
    });
    await store.reset();
    const results = await store.search(vec([1, 0, 0]), 5);
    assert.deepEqual(results, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
