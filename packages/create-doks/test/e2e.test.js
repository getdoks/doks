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
      /^tsx node_modules\/doks-core\/dist\/scripts\/ingest\.js/,
      'ingest script repointed via tsx (loads lib/doks.config.ts)',
    );

    const cfg = readFileSync(join(target, 'lib/site.config.ts'), 'utf8');
    assert.match(cfg, /siteName: "My Docs"/, 'siteName written');
    assert.match(cfg, /logoText: "My Docs"/, 'logoText written');
    assert.match(cfg, /defaultTheme: "light"/, 'defaultTheme written');

    // The monorepo's apps/site pins Turbopack to `resolve(__dirname, '..', '..')`
    // so workspace-hoisted deps resolve. Consumers are standalone, so the
    // pin must be rewritten to `import.meta.dirname`.
    const nextCfg = readFileSync(join(target, 'next.config.mjs'), 'utf8');
    assert.match(
      nextCfg,
      /turbopack:\s*\{\s*root:\s*import\.meta\.dirname,\s*\},/,
      'turbopack.root rewritten to import.meta.dirname',
    );
    assert.doesNotMatch(
      nextCfg,
      /resolve\(import\.meta\.dirname/,
      'monorepo-shaped resolve() pin removed',
    );
    assert.doesNotMatch(
      nextCfg,
      /^import \{ resolve \} from 'node:path';/m,
      'unused `resolve` import removed',
    );
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

test('scaffolds with --target cloudflare (split cf:* scripts + typegen)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  const target = join(dir, 'cf');
  try {
    runCli(
      `${JSON.stringify(target)} --yes --no-install --target cloudflare --template-path ${JSON.stringify(TEMPLATE)}`,
    );

    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));

    // Workers Builds (the Cloudflare UI) takes separate Build and
    // Deploy commands. The split scripts let users wire each field.
    assert.equal(
      pkg.scripts['cf:build'],
      'opennextjs-cloudflare build',
      'cf:build script present',
    );
    assert.equal(
      pkg.scripts['cf:deploy'],
      'opennextjs-cloudflare deploy',
      'cf:deploy script present',
    );

    // cf-typegen lets users regenerate cloudflare-env.d.ts after
    // wrangler.jsonc edits without remembering the wrangler invocation.
    assert.equal(
      pkg.scripts['cf-typegen'],
      'wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts',
      'cf-typegen script present',
    );

    // `npm run deploy` still does the chained build+deploy for the
    // local one-shot case (back-compat with older docs).
    assert.equal(
      pkg.scripts.deploy,
      'npm run cf:build && npm run cf:deploy',
      'deploy script chains the split commands',
    );

    // Cloudflare peer deps are declared.
    assert.ok(pkg.devDependencies['@opennextjs/cloudflare']);
    assert.ok(pkg.devDependencies['wrangler']);
    assert.ok(pkg.devDependencies['@cloudflare/workers-types']);
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
