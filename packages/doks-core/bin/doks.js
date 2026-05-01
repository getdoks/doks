#!/usr/bin/env node
import { execSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');

function help() {
  console.log(`
doks. Framework CLI

Usage:
  doks upgrade [--dry-run]      Bump doks-core to the latest npm version and
                                run any pending migrations.
  doks d1:init [--remote]       Print the D1 schema (pipe into wrangler) or,
                                with --remote, run it against a configured D1.
                                Wrangler must be installed in the project.
  doks d1:init --local <db>     Run the schema against a local D1 (wrangler
                                d1 execute --local).
  doks --help                   Show this help.

Run inside a project that has 'doks-core' as a dependency.
`);
}

const D1_SCHEMA = `DROP TABLE IF EXISTS chunks;
CREATE TABLE chunks (
  chunk_id   TEXT PRIMARY KEY,
  page_href  TEXT NOT NULL,
  page_title TEXT NOT NULL,
  heading    TEXT NOT NULL,
  category   TEXT,
  importance REAL NOT NULL,
  tags       TEXT NOT NULL,
  text       TEXT NOT NULL,
  embedding  BLOB NOT NULL
);
`;

function d1Init(args) {
  const remote = args.includes('--remote');
  const localIdx = args.indexOf('--local');
  const localDb = localIdx >= 0 ? args[localIdx + 1] : null;
  const remoteIdx = args.indexOf('--remote');
  const remoteDb =
    remoteIdx >= 0 && args[remoteIdx + 1] && !args[remoteIdx + 1].startsWith('-')
      ? args[remoteIdx + 1]
      : null;

  if (!remote && !localDb) {
    // No flags: dump SQL to stdout for manual piping.
    process.stdout.write(D1_SCHEMA);
    return;
  }

  // Run via wrangler. Pass the schema on stdin.
  const flag = remote
    ? `--remote${remoteDb ? ` ${remoteDb}` : ''}`
    : `--local ${localDb}`;
  // Wrangler doesn't read SQL from stdin reliably across versions; write
  // a temp file and use --file=.
  const target = remote ? remoteDb : localDb;
  if (!target) {
    fail(
      'doks d1:init: pass the database name. ' +
        'Examples: `doks d1:init --remote my-db` or ' +
        '`doks d1:init --local my-db`.',
    );
  }
  const tmp = join(process.cwd(), '.doks-d1-init.sql');
  try {
    writeFileSync(tmp, D1_SCHEMA);
    const cmd =
      `npx wrangler d1 execute ${target} ` +
      `${remote ? '--remote' : '--local'} --file=${tmp}`;
    console.log(`▸ ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
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
} else if (cmd === 'd1:init') {
  d1Init(process.argv.slice(3));
} else {
  fail(`Unknown command: ${cmd}`, 2);
}
