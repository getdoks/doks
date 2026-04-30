import { execSync } from 'node:child_process';
import {
  mkdtempSync,
  readdirSync,
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
