#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');

function help() {
  console.log(`
doks. Framework CLI

Usage:
  doks upgrade [--dry-run]   Bump doks-core to the latest npm version and
                             run any pending migrations.
  doks --help                Show this help.

Run inside a project that has 'doks-core' as a dependency.
`);
}

function readUserPkg(cwd) {
  const path = join(cwd, 'package.json');
  if (!existsSync(path)) {
    fail(`No package.json found at ${path}`);
  }
  return { path, pkg: JSON.parse(readFileSync(path, 'utf8')) };
}

function fail(msg, code = 1) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

function cmpSemver(a, b) {
  const norm = (v) => v.replace(/^[\^~]/, '').split('-')[0];
  const pa = norm(a).split('.').map((x) => Number(x) || 0);
  const pb = norm(b).split('.').map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

function listMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+\.\d+\.\d+\.js$/.test(f))
    .sort((a, b) => cmpSemver(a.replace('.js', ''), b.replace('.js', '')));
}

async function upgrade({ dryRun }) {
  const cwd = process.cwd();
  const { pkg } = readUserPkg(cwd);
  const installedSpec = pkg.dependencies?.['doks-core'];
  if (!installedSpec) {
    fail("'doks-core' not found in dependencies of package.json");
  }
  const installed = installedSpec.replace(/^[\^~]/, '');

  let latest;
  try {
    latest = execSync('npm view doks-core version', { encoding: 'utf8' }).trim();
  } catch (e) {
    fail(`Failed to fetch latest version (offline?): ${e.message}`);
  }

  console.log(`current: ${installed}  latest: ${latest}`);
  if (cmpSemver(installed, latest) >= 0) {
    console.log('Already up to date.');
    return;
  }

  if (dryRun) {
    const pending = listMigrations()
      .map((f) => f.replace('.js', ''))
      .filter(
        (v) => cmpSemver(v, installed) > 0 && cmpSemver(v, latest) <= 0,
      );
    console.log(`Would run ${pending.length} migration(s):`, pending);
    return;
  }

  console.log('Installing…');
  execSync(`npm install doks-core@${latest}`, { cwd, stdio: 'inherit' });

  for (const file of listMigrations()) {
    const ver = file.replace('.js', '');
    if (cmpSemver(ver, installed) > 0 && cmpSemver(ver, latest) <= 0) {
      console.log(`Running migration ${ver}…`);
      const mod = await import(join(MIGRATIONS_DIR, file));
      if (typeof mod.default !== 'function') {
        fail(`Migration ${file} has no default export`);
      }
      await mod.default({ root: cwd });
    }
  }

  console.log('Done.');
}

const cmd = process.argv[2];

if (!cmd || cmd === '--help' || cmd === '-h') {
  help();
  process.exit(cmd ? 0 : 1);
} else if (cmd === 'upgrade') {
  await upgrade({ dryRun: process.argv.includes('--dry-run') });
} else {
  fail(`Unknown command: ${cmd}`, 2);
}
