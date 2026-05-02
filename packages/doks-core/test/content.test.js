// Bundled-content runtime: generator emits a registerable module, and
// the data layer reads from the cache once registered.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildContent } from '../dist/scripts/buildContent.js';
import {
  setContentMap,
  getBundledMap,
  clearContentMap,
  CONTENT_SCHEMA_VERSION,
} from '../dist/runtime/content.js';

function mkTempProject() {
  const root = join(
    tmpdir(),
    `doks-content-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(join(root, 'content', 'docs', 'guides'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  writeFileSync(
    join(root, 'content', 'docs', 'index.mdx'),
    `---\ntitle: "Welcome"\norder: 0\n---\n\nHome.\n`,
  );
  writeFileSync(
    join(root, 'content', 'docs', 'guides', 'foo.mdx'),
    `---\ntitle: "Foo Guide"\nicon: "book"\n---\n\nBody of foo.\n`,
  );
  writeFileSync(
    join(root, 'content', 'docs', '_meta.json'),
    JSON.stringify({ guides: { label: 'Guides', order: 1 } }),
  );
  return root;
}

test('build:content emits a registerable module', () => {
  const root = mkTempProject();
  try {
    const result = buildContent({ root, silent: true });
    assert.equal(result.docs, 2, 'captures 2 mdx files');
    const out = readFileSync(result.outFile, 'utf8');
    assert.match(out, /setContentMap\(/, 'calls setContentMap');
    assert.match(out, /"schemaVersion":1/, 'embeds schema version');
    assert.match(out, /"slug":\[\]/, 'index doc has empty slug array');
    assert.match(out, /"Foo Guide"/, 'embeds frontmatter title');
    assert.match(out, /Body of foo/, 'embeds raw mdx body');
    assert.match(out, /"guides":\{"label":"Guides","order":1\}/, 'embeds rootMeta');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runtime cache: setContentMap → getBundledMap roundtrip', () => {
  clearContentMap();
  assert.equal(getBundledMap(), null, 'starts empty');
  setContentMap({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    docs: [
      {
        slug: ['intro'],
        href: '/docs/intro',
        frontmatter: { title: 'Intro' },
        raw: '# hello',
      },
    ],
    rootMeta: {},
  });
  const map = getBundledMap();
  assert.ok(map, 'cache populated');
  assert.equal(map.docs.length, 1);
  assert.equal(map.docs[0].slug[0], 'intro');
  assert.equal(map.docs[0].raw, '# hello');
  clearContentMap();
});

test('build:content writes output to the configured outFile', () => {
  const root = mkTempProject();
  try {
    const customOut = 'lib/custom-name.gen.ts';
    const result = buildContent({ root, outFile: customOut, silent: true });
    assert.ok(result.outFile.endsWith('lib/custom-name.gen.ts'));
    const out = readFileSync(result.outFile, 'utf8');
    assert.match(out, /setContentMap/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build:content with no docs directory writes empty map', () => {
  const root = join(tmpdir(), `doks-empty-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  try {
    const result = buildContent({ root, silent: true });
    assert.equal(result.docs, 0);
    const out = readFileSync(result.outFile, 'utf8');
    assert.match(out, /"docs":\[\]/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
