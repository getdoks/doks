// Bundled-content runtime: generator emits a registerable module that
// statically imports precompiled .mjs modules (no runtime eval, edge-safe).
// The runtime cache accepts both schemas; the data layer reads from it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
    `---\ntitle: "Foo Guide"\nicon: "book"\n---\n\n## Body of foo\n\nFoo body content.\n`,
  );
  writeFileSync(
    join(root, 'content', 'docs', '_meta.json'),
    JSON.stringify({ guides: { label: 'Guides', order: 1 } }),
  );
  return root;
}

test('build:content emits a gen file with static imports + setContentMap', async () => {
  const root = mkTempProject();
  try {
    const result = await buildContent({ root, silent: true });
    assert.equal(result.docs, 2, 'captures 2 mdx files');
    const out = readFileSync(result.outFile, 'utf8');
    assert.match(out, /setContentMap\(/, 'calls setContentMap');
    assert.match(out, /schemaVersion:\s*2/, 'embeds schema version 2');
    assert.match(out, /slug:\s*\[\]/, 'index doc has empty slug array');
    assert.match(out, /"Foo Guide"/, 'embeds frontmatter title');
    assert.match(out, /import \* as Doc0 from/, 'static import per doc');
    assert.match(out, /Component:\s*Doc0\.default/, 'wires Component to imported default');
    assert.match(out, /"guides":\{"label":"Guides","order":1\}/, 'embeds rootMeta');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build:content writes one .mjs per doc into compiledDir', async () => {
  const root = mkTempProject();
  try {
    await buildContent({ root, silent: true });
    const compiled = join(root, '.doks', 'compiled');
    assert.ok(existsSync(compiled), '.doks/compiled exists');
    const files = readdirSync(compiled).sort();
    assert.deepEqual(files, ['guides--foo.mjs', 'index.mjs']);
    const fooBody = readFileSync(join(compiled, 'guides--foo.mjs'), 'utf8');
    // Compiled MDX is real ESM with a default export of a JSX function.
    assert.match(fooBody, /export\s+default\s+/, 'has a default export');
    // No raw markdown / frontmatter survives — the compiler stripped it.
    assert.doesNotMatch(fooBody, /^---$/m, 'frontmatter removed');
    assert.doesNotMatch(fooBody, /^## Body of foo$/m, 'markdown headings compiled away');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build:content output is eval-free (no runtime new Function / eval)', async () => {
  const root = mkTempProject();
  try {
    const result = await buildContent({ root, silent: true });
    const gen = readFileSync(result.outFile, 'utf8');
    // The whole point of schema 2: the gen file does not embed code
    // strings that a runtime would have to compile. It only contains
    // static imports + a literal data object.
    assert.doesNotMatch(gen, /new Function/, 'gen file has no new Function');
    assert.doesNotMatch(gen, /\beval\(/, 'gen file does not call eval()');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runtime cache: setContentMap → getBundledMap roundtrip', () => {
  clearContentMap();
  assert.equal(getBundledMap(), null, 'starts empty');
  // Stub component — runtime never calls it in this test.
  const StubComponent = () => null;
  setContentMap({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    docs: [
      {
        slug: ['intro'],
        href: '/docs/intro',
        frontmatter: { title: 'Intro' },
        raw: '# hello',
        Component: StubComponent,
      },
    ],
    rootMeta: {},
  });
  const map = getBundledMap();
  assert.ok(map, 'cache populated');
  assert.equal(map.docs.length, 1);
  assert.equal(map.docs[0].slug[0], 'intro');
  assert.equal(map.docs[0].raw, '# hello');
  assert.equal(map.docs[0].Component, StubComponent, 'Component round-trips');
  clearContentMap();
});

test('runtime cache: schema 1 maps still register (with deprecation warn)', () => {
  clearContentMap();
  const origWarn = console.warn;
  const captured = [];
  console.warn = (...args) => captured.push(args.join(' '));
  try {
    setContentMap({
      schemaVersion: 1,
      docs: [
        { slug: [], href: '/docs', frontmatter: { title: 'Old' }, raw: 'hi' },
      ],
      rootMeta: {},
    });
    const map = getBundledMap();
    assert.ok(map, 'old-schema map still loads');
    assert.equal(map.docs[0].raw, 'hi');
    assert.ok(
      captured.some((m) => /older schema/i.test(m)),
      'warns about old schema',
    );
  } finally {
    console.warn = origWarn;
    clearContentMap();
  }
});

test('build:content writes output to the configured outFile', async () => {
  const root = mkTempProject();
  try {
    const customOut = 'lib/custom-name.gen.ts';
    const result = await buildContent({
      root,
      outFile: customOut,
      silent: true,
    });
    assert.ok(result.outFile.endsWith('lib/custom-name.gen.ts'));
    const out = readFileSync(result.outFile, 'utf8');
    assert.match(out, /setContentMap/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build:content with no docs directory writes empty map', async () => {
  const root = join(tmpdir(), `doks-empty-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  try {
    const result = await buildContent({ root, silent: true });
    assert.equal(result.docs, 0);
    const out = readFileSync(result.outFile, 'utf8');
    assert.match(out, /docs:\s*\[\s*\]/, 'empty docs array');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
