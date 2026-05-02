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
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');

// Detect the active package manager from the user-agent npm sets when it
// runs scripts. bun, pnpm, and yarn set the same convention. Falls back
// to npm if the project was invoked outside of a script.
function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || '';
  if (ua.startsWith('bun')) return 'bun';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  return 'npm';
}

function pmRun(script) {
  const pm = detectPackageManager();
  // bun, pnpm, yarn, npm all support `<pm> run <script>`.
  return `${pm} run ${script}`;
}

function pmInstallDev(packages) {
  const pm = detectPackageManager();
  const list = Array.isArray(packages) ? packages.join(' ') : packages;
  switch (pm) {
    case 'bun': return `bun add -D ${list}`;
    case 'pnpm': return `pnpm add -D ${list}`;
    case 'yarn': return `yarn add -D ${list}`;
    default: return `npm install -D ${list}`;
  }
}

function pmInstall(spec) {
  const pm = detectPackageManager();
  switch (pm) {
    case 'bun': return `bun add ${spec}`;
    case 'pnpm': return `pnpm add ${spec}`;
    case 'yarn': return `yarn add ${spec}`;
    default: return `npm install ${spec}`;
  }
}

function help() {
  console.log(`
doks. Framework CLI

Usage:
  doks upgrade [--dry-run]      Bump doks-core to the latest npm version and
                                run any pending migrations.
  doks ensure-index             Build data/docs.db if it's missing. Used as a
                                \`predev\` hook so first-time \`npm run dev\` does
                                not show an empty search panel. Skips silently
                                for non-SQLite adapters.
  doks build:content            Generate \`lib/doks-content.gen.ts\` from the
                                \`content/docs/\` tree. Snapshot of every MDX
                                file (frontmatter + raw source + slug) so doc
                                pages can render at request time on edge
                                runtimes without filesystem access. Used as a
                                \`predev\` / \`prebuild\` hook by the scaffold.
  doks d1:init [--remote <db>]  Print the D1 schema (pipe into wrangler) or,
                                with --remote/--local, run it against a
                                configured D1. Wrangler must be installed.
  doks d1:init --local <db>     Run the schema against a local D1 (wrangler
                                d1 execute --local).
  doks setup-cloudflare         One-shot Cloudflare provisioner: creates a
                                D1 database, an R2 bucket, runs the chunks
                                schema, and prints a wrangler.jsonc snippet.
                                Flags:
                                  --db <name>      D1 database name
                                  --bucket <name>  R2 bucket name (cache)
                                  --worker <name>  Worker name
                                  --skip-d1        skip D1 create+schema
                                  --skip-r2        skip R2 bucket create
                                  --skip-schema    skip running chunks schema
  doks deploy:cloudflare        End-to-end Cloudflare wiring: install peer
                                deps, provision D1 + R2, write wrangler.jsonc,
                                swap lib/doks.config.ts to D1, write
                                lib/doks.config.ingest.ts, uncomment the
                                OpenNext dev hook in next.config.mjs, write
                                open-next.config.ts, and prompt for the
                                Cloudflare API token to populate .env.local.
                                Add --dry-run to see the plan without writing.
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

function provisionCloudflare(args) {
  const cwd = process.cwd();
  const { pkg } = readUserPkg(cwd);
  const projectSlug = String(pkg.name || 'doks-site')
    .replace(/^@[^/]+\//, '')
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '') || 'doks-site';

  const flagValue = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return null;
    const v = args[i + 1];
    return v && !v.startsWith('-') ? v : null;
  };

  const worker = flagValue('--worker') || projectSlug;
  const db = flagValue('--db') || `${projectSlug}-vectors`;
  const bucket = flagValue('--bucket') || `${projectSlug}-cache`;
  const skipD1 = args.includes('--skip-d1');
  const skipR2 = args.includes('--skip-r2');
  const skipSchema = args.includes('--skip-schema');

  console.log('▸ doks setup-cloudflare');
  console.log(`  worker: ${worker}`);
  console.log(`  d1:     ${skipD1 ? '(skipped)' : db}`);
  console.log(`  r2:     ${skipR2 ? '(skipped)' : bucket}`);
  console.log('');

  let dbId = null;
  if (!skipD1) {
    console.log(`▸ wrangler d1 create ${db}`);
    let out;
    try {
      out = execSync(`npx wrangler d1 create ${db}`, { encoding: 'utf8' });
      process.stdout.write(out);
    } catch (e) {
      const stderr = String(e.stderr || e.stdout || '');
      if (/already exists/i.test(stderr)) {
        console.log(`  ⚠ D1 '${db}' already exists. Skipping create.`);
        console.log(
          `  Look up the database_id with: npx wrangler d1 list`,
        );
      } else {
        fail(
          `wrangler d1 create failed:\n${stderr || e.message}\n\n` +
            `Authenticate with \`npx wrangler login\` and try again.`,
        );
      }
    }
    if (out) {
      const m = out.match(/database_id\s*=\s*"([0-9a-f-]{36})"/i);
      if (m) dbId = m[1];
    }

    if (!skipSchema) {
      console.log(`▸ running chunks schema against ${db}`);
      const tmp = join(cwd, '.doks-d1-init.sql');
      try {
        writeFileSync(tmp, D1_SCHEMA);
        execSync(
          `npx wrangler d1 execute ${db} --remote --file=${tmp}`,
          { stdio: 'inherit' },
        );
      } catch (e) {
        console.error(`  ✗ schema failed: ${e.message}`);
      } finally {
        try { unlinkSync(tmp); } catch { /* ignore */ }
      }
    }
  }

  if (!skipR2) {
    console.log(`▸ wrangler r2 bucket create ${bucket}`);
    try {
      execSync(`npx wrangler r2 bucket create ${bucket}`, {
        stdio: 'inherit',
      });
    } catch (e) {
      const stderr = String(e.stderr || '');
      if (/already exists/i.test(stderr)) {
        console.log(`  ⚠ R2 bucket '${bucket}' already exists. Skipping.`);
      } else {
        console.error(`  ⚠ r2 bucket create returned non-zero. Continuing.`);
      }
    }
  }

  // Emit a wrangler.jsonc snippet the user can merge into their config.
  const snippet = {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: worker,
    main: '.open-next/worker.js',
    compatibility_date: new Date().toISOString().slice(0, 10),
    compatibility_flags: ['nodejs_compat'],
    observability: { enabled: true },
    assets: {
      directory: '.open-next/assets',
      binding: 'ASSETS',
    },
    services: [
      { binding: 'WORKER_SELF_REFERENCE', service: worker },
    ],
    ...(skipD1
      ? {}
      : {
          d1_databases: [
            {
              binding: 'DB',
              database_name: db,
              database_id: dbId || '<paste-from-wrangler-output-above>',
            },
          ],
        }),
    ...(skipR2
      ? {}
      : {
          r2_buckets: [
            {
              binding: 'NEXT_INC_CACHE_R2_BUCKET',
              bucket_name: bucket,
            },
          ],
        }),
  };

  return { worker, db, bucket, dbId, snippet, skipD1, skipR2 };
}

function setupCloudflare(args) {
  const result = provisionCloudflare(args);
  console.log('');
  console.log('▸ wrangler.jsonc snippet (merge into your file):');
  console.log('');
  console.log(JSON.stringify(result.snippet, null, 2));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Save the snippet above to wrangler.jsonc.');
  console.log('  2. Switch lib/doks.config.ts to the D1 adapter (see docs).');
  console.log('  3. Add `export { default } from "doks-core/cloudflare/open-next";`');
  console.log('     to open-next.config.ts.');
  console.log('  4. Ingest:');
  console.log(`       DOKS_CONFIG=lib/doks.config.ingest.ts ${pmRun('ingest')}`);
  console.log(`  5. Deploy: ${pmRun('deploy')}`);
  console.log('');
  console.log('Or run `doks deploy:cloudflare` to do all of the above in one go.');
  return result;
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

  const installCmd = pmInstall(`doks-core@${latest}`);
  console.log(`Installing… (\`${installCmd}\`)`);
  execSync(installCmd, { cwd, stdio: 'inherit' });

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

// ---------------------------------------------------------------
// `doks ensure-index`: predev hook. Build the SQLite index if missing.
// ---------------------------------------------------------------

function findConfigPath(cwd) {
  for (const rel of ['lib/doks.config.ts', 'lib/doks.config.js', 'lib/doks.config.mjs']) {
    const abs = join(cwd, rel);
    if (existsSync(abs)) return { rel, abs };
  }
  return null;
}

function ensureIndex() {
  const cwd = process.cwd();
  const config = findConfigPath(cwd);
  if (!config) {
    // No config — quiet noop. The dev server will surface real errors.
    return;
  }
  const src = readFileSync(config.abs, 'utf8');

  // Detect adapter. Anything other than SQLite is the user's responsibility
  // (D1 ingest needs a DOKS_CONFIG override, etc.) — we don't want to
  // stomp on a remote-D1 setup with a local ingest.
  if (!/createSqliteStore/.test(src)) {
    return;
  }

  const m = src.match(/path:\s*["']([^"']+)["']/);
  const dbPath = m ? m[1] : 'data/docs.db';
  if (existsSync(join(cwd, dbPath))) {
    return;
  }

  const cmd = pmRun('ingest');
  console.log(`▸ ensure-index: ${dbPath} missing, running \`${cmd}\`…`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
  } catch (e) {
    fail(`ingest failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------
// `doks deploy:cloudflare`: end-to-end Cloudflare wiring.
// ---------------------------------------------------------------

const D1_RUNTIME_CONFIG = `// Vector-store configuration. Both the search route and the ingest CLI
// read from here.
//
// Cloudflare runtime: D1 binding is per-request, so export a thunk.
// For Node-side ingest, use lib/doks.config.ingest.ts.

import { createD1Store } from "doks-core/adapters/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { VectorStore } from "doks-core";

export const vectorStore = (): VectorStore =>
  createD1Store(getCloudflareContext().env.DB);
`;

const D1_INGEST_CONFIG = `// Node-side ingest config. Talks to the Cloudflare D1 REST API directly,
// so it does not depend on \`getCloudflareContext()\` (Worker-only).
//
// Run with:
//   DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest

import { createD1HttpStore } from "doks-core/adapters/d1/http";
import type { VectorStore } from "doks-core";

export const vectorStore: VectorStore = createD1HttpStore({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});
`;

const OPEN_NEXT_CONFIG = `// Cloudflare-only: read by \`opennextjs-cloudflare build\`.
// Re-exports the doks-core default config (R2-backed incremental cache,
// binding NEXT_INC_CACHE_R2_BUCKET).

export { default } from "doks-core/cloudflare/open-next";
`;

function ensurePeerDeps(cwd, pkg, dryRun) {
  const required = [
    '@cloudflare/workers-types',
    '@opennextjs/cloudflare',
    'wrangler',
  ];
  const installed = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const missing = required.filter((p) => !installed[p]);
  if (!missing.length) {
    console.log('▸ peer deps: already installed');
    return;
  }
  const cmd = pmInstallDev(missing);
  console.log(`▸ installing peer deps: ${cmd}`);
  if (dryRun) {
    console.log('  (dry-run, skipping)');
    return;
  }
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function checkWranglerLogin() {
  try {
    execSync('npx wrangler whoami', { stdio: 'pipe' });
    console.log('▸ wrangler: authenticated');
    return true;
  } catch {
    console.log('▸ wrangler: not authenticated');
    console.log('  Run `npx wrangler login` in another terminal, then re-run.');
    return false;
  }
}

function writeWranglerJsonc(cwd, snippet, dryRun) {
  const path = join(cwd, 'wrangler.jsonc');
  if (dryRun) {
    console.log(`▸ would write wrangler.jsonc (${path})`);
    return;
  }
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf8');
    if (existing.trim()) {
      const backup = `${path}.bak`;
      writeFileSync(backup, existing);
      console.log(`▸ wrangler.jsonc exists. Backed up to wrangler.jsonc.bak.`);
    }
  }
  writeFileSync(path, JSON.stringify(snippet, null, 2) + '\n');
  console.log('  + wrote wrangler.jsonc');
}

function writeRuntimeConfig(cwd, dryRun) {
  const rel = 'lib/doks.config.ts';
  const path = join(cwd, rel);
  if (existsSync(path)) {
    const src = readFileSync(path, 'utf8');
    if (/createD1Store/.test(src) && /getCloudflareContext/.test(src)) {
      console.log(`▸ ${rel}: already on D1 thunk, skipped`);
      return;
    }
    if (!/createSqliteStore/.test(src)) {
      console.log(`▸ ${rel}: customised, leaving alone (verify D1 manually)`);
      return;
    }
  }
  if (dryRun) {
    console.log(`▸ would rewrite ${rel} to D1 thunk`);
    return;
  }
  writeFileSync(path, D1_RUNTIME_CONFIG);
  console.log(`  + rewrote ${rel} → D1 adapter (thunk)`);
}

function writeIngestConfig(cwd, dryRun) {
  const rel = 'lib/doks.config.ingest.ts';
  const path = join(cwd, rel);
  if (existsSync(path)) {
    console.log(`▸ ${rel}: exists, skipped`);
    return;
  }
  if (dryRun) {
    console.log(`▸ would write ${rel}`);
    return;
  }
  writeFileSync(path, D1_INGEST_CONFIG);
  console.log(`  + wrote ${rel}`);
}

function writeOpenNextConfig(cwd, dryRun) {
  const rel = 'open-next.config.ts';
  const path = join(cwd, rel);
  if (existsSync(path)) {
    const src = readFileSync(path, 'utf8');
    if (/doks-core\/cloudflare\/open-next/.test(src)) {
      console.log(`▸ ${rel}: already wired, skipped`);
      return;
    }
    console.log(`▸ ${rel}: customised, leaving alone`);
    return;
  }
  if (dryRun) {
    console.log(`▸ would write ${rel}`);
    return;
  }
  writeFileSync(path, OPEN_NEXT_CONFIG);
  console.log(`  + wrote ${rel}`);
}

function uncommentOpenNextDevHook(cwd, dryRun) {
  const rel = 'next.config.mjs';
  const path = join(cwd, rel);
  if (!existsSync(path)) {
    console.log(`▸ ${rel}: not found, skipped`);
    return;
  }
  const src = readFileSync(path, 'utf8');
  if (/^\s*initOpenNextCloudflareForDev\(\);\s*$/m.test(src)) {
    console.log(`▸ ${rel}: dev hook already active, skipped`);
    return;
  }
  // Match the commented-out scaffold block.
  const replaced = src.replace(
    /\/\/\s*import\s+\{\s*initOpenNextCloudflareForDev\s*\}\s+from\s+'@opennextjs\/cloudflare';\s*\n\s*\/\/\s*initOpenNextCloudflareForDev\(\);/,
    `import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';\ninitOpenNextCloudflareForDev();`,
  );
  if (replaced === src) {
    console.log(
      `▸ ${rel}: could not locate the scaffold's commented OpenNext block. ` +
        `Add this manually:\n` +
        `    import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';\n` +
        `    initOpenNextCloudflareForDev();`,
    );
    return;
  }
  if (dryRun) {
    console.log(`▸ would uncomment OpenNext dev hook in ${rel}`);
    return;
  }
  writeFileSync(path, replaced);
  console.log(`  + uncommented OpenNext dev hook in ${rel}`);
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a); }));
}

async function writeEnvLocal(cwd, dryRun) {
  const rel = '.env.local';
  const path = join(cwd, rel);
  let existing = '';
  if (existsSync(path)) existing = readFileSync(path, 'utf8');

  const needs = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_DATABASE_ID', 'CLOUDFLARE_API_TOKEN'];
  const missing = needs.filter((k) => !new RegExp(`^${k}=`, 'm').test(existing));
  if (!missing.length) {
    console.log(`▸ ${rel}: all Cloudflare env vars already set, skipped`);
    return;
  }

  console.log(`▸ ${rel}: prompting for ${missing.length} value(s) (leave blank to skip)`);
  if (dryRun) {
    console.log('  (dry-run, skipping prompts)');
    return;
  }
  let appended = '';
  for (const key of missing) {
    const value = (await prompt(`  ${key}: `)).trim();
    if (value) appended += `${key}=${value}\n`;
    else appended += `# ${key}=\n`;
  }
  const next = (existing.endsWith('\n') || !existing ? existing : existing + '\n') + appended;
  writeFileSync(path, next);
  console.log(`  + wrote ${missing.length} entr${missing.length === 1 ? 'y' : 'ies'} to ${rel}`);
}

async function deployCloudflare(args) {
  const dryRun = args.includes('--dry-run');
  const cwd = process.cwd();
  const { pkg } = readUserPkg(cwd);

  console.log(`▸ doks deploy:cloudflare${dryRun ? ' (dry-run)' : ''}`);
  console.log('');

  ensurePeerDeps(cwd, pkg, dryRun);
  console.log('');

  if (!dryRun && !checkWranglerLogin()) {
    fail('wrangler not authenticated');
  }
  console.log('');

  // Provision D1 + R2 (also runs schema unless --skip-schema).
  let result;
  if (dryRun) {
    console.log('▸ would run setup-cloudflare to provision D1 + R2');
    // Build a fake snippet so the file mutations still get a sensible plan.
    result = {
      snippet: { name: '<worker-name>', d1_databases: [], r2_buckets: [] },
    };
  } else {
    result = provisionCloudflare(args.filter((a) => a !== '--dry-run'));
  }
  console.log('');

  writeWranglerJsonc(cwd, result.snippet, dryRun);
  writeRuntimeConfig(cwd, dryRun);
  writeIngestConfig(cwd, dryRun);
  writeOpenNextConfig(cwd, dryRun);
  uncommentOpenNextDevHook(cwd, dryRun);
  console.log('');

  await writeEnvLocal(cwd, dryRun);
  console.log('');

  if (dryRun) {
    console.log('▸ dry-run complete. Re-run without --dry-run to apply.');
    return;
  }
  console.log('▸ done. Next:');
  console.log(`    DOKS_CONFIG=lib/doks.config.ingest.ts ${pmRun('ingest')}`);
  console.log(`    ${pmRun('deploy')}`);
}

const cmd = process.argv[2];

if (!cmd || cmd === '--help' || cmd === '-h') {
  help();
  process.exit(cmd ? 0 : 1);
} else if (cmd === 'upgrade') {
  await upgrade({ dryRun: process.argv.includes('--dry-run') });
} else if (cmd === 'ensure-index') {
  ensureIndex();
} else if (cmd === 'build:content') {
  let mod;
  try {
    mod = await import('../dist/scripts/buildContent.js');
  } catch (err) {
    fail(
      `build:content: could not load dist/scripts/buildContent.js. ` +
        `Run \`npm install\` first (or \`npm run build -w doks-core\` ` +
        `if you're working in the workspace). Inner error: ${(err && err.message) || err}`,
    );
  }
  mod.buildContent();
} else if (cmd === 'd1:init') {
  d1Init(process.argv.slice(3));
} else if (cmd === 'setup-cloudflare') {
  setupCloudflare(process.argv.slice(3));
} else if (cmd === 'deploy:cloudflare') {
  await deployCloudflare(process.argv.slice(3));
} else {
  fail(`Unknown command: ${cmd}`, 2);
}
