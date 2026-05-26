import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', 'bin', 'doks.js');

function run(args, opts = {}) {
  return execSync(`node ${JSON.stringify(CLI)} ${args}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
}

test('--help prints usage', () => {
  const out = run('--help');
  assert.match(out, /doks upgrade/);
});

test('upgrade fails when no package.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  try {
    assert.throws(
      () => run('upgrade --dry-run', { cwd: dir }),
      /No package\.json/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("upgrade fails when doks-core isn't a dependency", () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'no-doks', dependencies: {} }, null, 2),
    );
    assert.throws(
      () => run('upgrade --dry-run', { cwd: dir }),
      /'doks-core' not found/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migrations dir contains versioned files only', () => {
  const dir = resolve(__dirname, '..', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert.ok(files.length >= 1, 'at least one migration');
  for (const f of files) {
    assert.match(f, /^\d+\.\d+\.\d+\.js$/, `${f} matches X.Y.Z.js`);
  }
});

// `setup-cloudflare` previously ignored unknown flags and ran the
// bootstrap unconditionally — so `--help` on the unfixed version would
// CREATE a real D1 database. This guards against regressing back to
// that behaviour. Every test below MUST exit before any wrangler shell
// out happens. We accomplish that with --dry-run / --help / unknown
// flag short-circuits, plus an explicit --skip-d1 --skip-r2 wherever
// dry-run pathways still touch the provisioner.

test('setup-cloudflare --help exits 0 without touching Cloudflare', () => {
  const out = run('setup-cloudflare --help');
  assert.match(out, /doks setup-cloudflare/);
  assert.match(out, /--dry-run/);
  assert.match(out, /--env <name>/);
  // The help text must NOT shell out to wrangler; if it did, the
  // `npx wrangler` output ("ℹ ️ Creating D1 database…") would leak in.
  assert.doesNotMatch(out, /wrangler d1 create/);
  assert.doesNotMatch(out, /Creating database/);
});

test('setup-cloudflare rejects unknown flags with exit code 2', () => {
  let err;
  try {
    run('setup-cloudflare --frobnicate');
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'expected non-zero exit');
  assert.equal(err.status, 2, 'exit code 2 for arg parse failure');
  const combined = String(err.stdout || '') + String(err.stderr || '');
  assert.match(combined, /Unknown flag: --frobnicate/);
});

test('setup-cloudflare --dry-run --yes does not invoke wrangler', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'demo' }, null, 2),
    );
    const out = run('setup-cloudflare --dry-run --yes', { cwd: dir });
    assert.match(out, /dry-run/);
    assert.match(out, /would: npx wrangler d1 create demo-vectors/);
    assert.match(out, /would: npx wrangler r2 bucket create demo-cache/);
    assert.match(out, /would write wrangler\.jsonc/);
    assert.match(out, /would: npx wrangler types/);
    // No actual file should have been written.
    const written = readdirSync(dir);
    assert.deepEqual(
      written.sort(),
      ['package.json'],
      'dry-run wrote no files',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setup-cloudflare --env <name> suffixes default resource names', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'demo' }, null, 2),
    );
    const out = run(
      'setup-cloudflare --dry-run --yes --env staging --skip-write --skip-types',
      { cwd: dir },
    );
    assert.match(out, /env: staging/);
    assert.match(out, /demo-vectors-staging/);
    assert.match(out, /demo-cache-staging/);
    assert.match(out, /demo-staging/);
    // The printed snippet wraps under env.staging.
    assert.match(out, /"env":/);
    assert.match(out, /"staging":/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setup-cloudflare --skip-r2 suggests the no-cache open-next entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doks-cli-'));
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'demo' }, null, 2),
    );
    const out = run(
      'setup-cloudflare --dry-run --yes --skip-r2 --skip-write --skip-types',
      { cwd: dir },
    );
    assert.match(
      out,
      /doks-core\/cloudflare\/open-next\/no-cache/,
      'next-steps hint should point at the no-cache variant',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('open-next: exports map publishes both R2 and no-cache entries', () => {
  // Static check — the dist files import @opennextjs/cloudflare which
  // is an optional peer dep (not installed in this workspace), so we
  // can't `import()` them at test time. Instead assert the package.json
  // exports map carries both entries, and the dist files exist on
  // disk so they'd resolve once the peer dep is present.
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'),
  );
  assert.equal(
    pkg.exports['./cloudflare/open-next'],
    './dist/cloudflare/openNext.js',
    'R2-backed export wired',
  );
  assert.equal(
    pkg.exports['./cloudflare/open-next/no-cache'],
    './dist/cloudflare/openNextNoCache.js',
    'no-cache export wired',
  );
  assert.ok(
    existsSync(resolve(__dirname, '..', 'dist/cloudflare/openNext.js')),
    'R2-backed dist file emitted',
  );
  assert.ok(
    existsSync(resolve(__dirname, '..', 'dist/cloudflare/openNextNoCache.js')),
    'no-cache dist file emitted',
  );
});
