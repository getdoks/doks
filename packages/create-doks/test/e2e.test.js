import { execSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', 'index.js');
const TEMPLATE = resolve(__dirname, '..', '..', '..', 'apps', 'site');

function runCli(args, opts = {}) {
  return execSync(`node ${JSON.stringify(CLI)} ${args}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
}

test('scaffolds with --samples (full demo corpus retained)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  const target = join(dir, 'demo');
  try {
    runCli(
      `${JSON.stringify(target)} --yes --no-install --samples --template-path ${JSON.stringify(TEMPLATE)}`,
    );

    assert.ok(existsSync(join(target, 'package.json')), 'package.json exists');
    assert.ok(
      existsSync(join(target, 'lib/site.config.ts')),
      'site.config.ts exists',
    );
    assert.ok(
      existsSync(join(target, 'app/layout.tsx')),
      'app/layout.tsx exists',
    );
    assert.ok(
      existsSync(join(target, 'content/docs/index.mdx')),
      'home page present',
    );
    assert.ok(
      existsSync(join(target, 'content/docs/samples')),
      'samples directory retained',
    );
    assert.ok(
      existsSync(join(target, 'content/docs/getting-started')),
      'getting-started retained',
    );
    assert.ok(
      existsSync(join(target, 'content/docs/_meta.json')),
      'central _meta.json retained',
    );
    assert.ok(
      !existsSync(join(target, 'node_modules')),
      'node_modules excluded by filter',
    );
    assert.ok(
      !existsSync(join(target, '.next')),
      '.next excluded by filter',
    );

    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'demo', 'package name slugged from basename');
    assert.equal(
      pkg.dependencies['doks-core'],
      'latest',
      'doks-core spec rewritten to latest',
    );
    assert.match(
      pkg.scripts.ingest,
      /node_modules\/doks-core\/dist\/scripts\/ingest\.js/,
      'ingest script repointed',
    );

    const cfg = readFileSync(join(target, 'lib/site.config.ts'), 'utf8');
    assert.match(cfg, /siteName: "My Docs"/, 'siteName written');
    assert.match(cfg, /logoText: "My Docs"/, 'logoText written');
    assert.match(cfg, /defaultTheme: "light"/, 'defaultTheme written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffolds with --no-samples (clean slate, single index.mdx)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  const target = join(dir, 'clean');
  try {
    runCli(
      `${JSON.stringify(target)} --yes --no-install --no-samples --template-path ${JSON.stringify(TEMPLATE)}`,
    );

    // Framework chrome should be intact.
    assert.ok(existsSync(join(target, 'package.json')));
    assert.ok(existsSync(join(target, 'lib/site.config.ts')));
    assert.ok(existsSync(join(target, 'app/layout.tsx')));

    // Demo corpus is gone.
    assert.ok(
      !existsSync(join(target, 'content/docs/samples')),
      'samples directory removed',
    );
    assert.ok(
      !existsSync(join(target, 'content/docs/getting-started')),
      'getting-started removed',
    );
    assert.ok(
      !existsSync(join(target, 'content/docs/reference')),
      'reference removed',
    );
    assert.ok(
      !existsSync(join(target, 'content/docs/_meta.json')),
      'central _meta.json removed',
    );

    // A minimal home page is in its place.
    const docsContents = readdirSync(join(target, 'content/docs'));
    assert.deepEqual(
      docsContents.sort(),
      ['index.mdx'],
      'content/docs holds only index.mdx',
    );
    const home = readFileSync(
      join(target, 'content/docs/index.mdx'),
      'utf8',
    );
    assert.match(home, /title: "Welcome"/);
    assert.match(home, /Welcome to My Docs/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refuses to overwrite a non-empty target', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  const target = join(dir, 'demo');
  try {
    runCli(
      `${JSON.stringify(target)} --yes --no-install --template-path ${JSON.stringify(TEMPLATE)}`,
    );
    assert.throws(
      () =>
        runCli(
          `${JSON.stringify(target)} --yes --no-install --template-path ${JSON.stringify(TEMPLATE)}`,
        ),
      /already exists and is not empty/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--help prints usage and exits 0', () => {
  const out = runCli('--help');
  assert.match(out, /create-doks/);
  assert.match(out, /--template-path/);
  assert.match(out, /--samples/);
  assert.match(out, /--no-samples/);
});
