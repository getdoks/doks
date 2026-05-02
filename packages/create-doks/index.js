#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import prompts from 'prompts';
import degit from 'degit';
import kleur from 'kleur';

// Pinned to a tag so a `npx create-doks@0.2.x` always emits the
// 0.2.x-shaped template even if `apps/site` on main moves ahead.
// Bump in lock-step with doks-core releases that change the template.
const DEFAULT_TEMPLATE = 'getdoks/doks/apps/site#v0.3.5';
const THEMES = ['light', 'dark', 'blue-pearl', 'sand'];

const DEPLOY_TARGETS = ['vercel', 'cloudflare'];

const PACKAGE_MANAGERS = ['npm', 'bun', 'pnpm', 'yarn'];

function detectInvokingPm() {
  const ua = process.env.npm_config_user_agent || '';
  if (ua.startsWith('bun')) return 'bun';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  return 'npm';
}

function pmInstallCmd(pm) {
  return pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn' : `${pm} install`;
}

function pmRunCmd(pm, script) {
  return `${pm} run ${script}`;
}

function parseArgs(argv) {
  const args = { flags: {}, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-install') args.flags.noInstall = true;
    else if (a === '--yes' || a === '-y') args.flags.yes = true;
    else if (a === '--help' || a === '-h') args.flags.help = true;
    else if (a === '--template-path') args.flags.templatePath = argv[++i];
    else if (a === '--template') args.flags.template = argv[++i];
    else if (a === '--samples') args.flags.samples = true;
    else if (a === '--no-samples') args.flags.samples = false;
    else if (a === '--target') args.flags.target = argv[++i];
    else if (a === '--pm') args.flags.pm = argv[++i];
    else if (a.startsWith('--')) {
      console.error(kleur.red(`Unknown flag: ${a}`));
      process.exit(2);
    } else {
      args.positional.push(a);
    }
  }
  if (args.flags.target && !DEPLOY_TARGETS.includes(args.flags.target)) {
    console.error(
      kleur.red(`--target must be one of: ${DEPLOY_TARGETS.join(', ')}`),
    );
    process.exit(2);
  }
  if (args.flags.pm && !PACKAGE_MANAGERS.includes(args.flags.pm)) {
    console.error(
      kleur.red(`--pm must be one of: ${PACKAGE_MANAGERS.join(', ')}`),
    );
    process.exit(2);
  }
  return args;
}

function printHelp() {
  console.log(`
${kleur.bold('create-doks')}. Scaffold a new doks documentation site.

${kleur.bold('Usage:')}
  npx create-doks [target] [options]

${kleur.bold('Arguments:')}
  target                 directory to create (prompted if omitted)

${kleur.bold('Options:')}
  --template <spec>      degit template spec (default: ${DEFAULT_TEMPLATE})
  --template-path <dir>  copy from a local directory instead of degit
  --samples              keep the demo MDX corpus (Hero, Callouts, archetypes, …)
  --no-samples           strip the demo content; start with a single index.mdx
  --target <host>        deploy target: 'vercel' (Node + SQLite, default) or
                         'cloudflare' (Workers + D1 + R2)
  --pm <manager>         package manager: npm (default), bun, pnpm, or yarn.
                         Auto-detected from how you invoked the CLI.
  --no-install           skip the install step after scaffolding
  -y, --yes              accept defaults for all prompts
  -h, --help             show this help
`);
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    return;
  }

  const targetArg = positional[0];

  const responses = await prompts(
    [
      {
        type: targetArg || flags.yes ? null : 'text',
        name: 'target',
        message: 'Project directory:',
        initial: 'my-docs',
      },
      {
        type: flags.yes ? null : 'text',
        name: 'siteName',
        message: 'Site name:',
        initial: 'My Docs',
      },
      {
        type: flags.yes ? null : 'text',
        name: 'githubUrl',
        message: 'GitHub repo URL:',
        initial: 'https://github.com/your-org/your-repo',
      },
      {
        type: flags.yes ? null : 'select',
        name: 'theme',
        message: 'Default theme:',
        choices: THEMES.map((t) => ({ title: t, value: t })),
        initial: 0,
      },
      {
        type: flags.yes || flags.samples !== undefined ? null : 'confirm',
        name: 'samples',
        message: 'Keep the demo MDX content as a learning reference?',
        initial: false,
      },
      {
        type: flags.yes || flags.target ? null : 'select',
        name: 'deployTarget',
        message: 'Deploy target:',
        choices: [
          { title: 'Vercel / Node (SQLite)', value: 'vercel' },
          { title: 'Cloudflare Workers (D1 + R2)', value: 'cloudflare' },
        ],
        initial: 0,
      },
    ],
    { onCancel: () => process.exit(1) },
  );

  const targetName = targetArg || responses.target || 'my-docs';
  const siteName = responses.siteName || 'My Docs';
  const githubUrl =
    responses.githubUrl || 'https://github.com/your-org/your-repo';
  const theme = responses.theme || 'light';
  // Resolve samples: explicit flag wins; prompt next; default false.
  const samples =
    flags.samples !== undefined
      ? flags.samples
      : responses.samples !== undefined
        ? responses.samples
        : false;
  const deployTarget = flags.target || responses.deployTarget || 'vercel';
  const pm = flags.pm || detectInvokingPm();

  const targetDir = resolve(targetName);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    console.error(kleur.red(`✗ ${targetDir} already exists and is not empty.`));
    process.exit(1);
  }
  mkdirSync(targetDir, { recursive: true });

  if (flags.templatePath) {
    const src = resolve(flags.templatePath);
    if (!existsSync(src)) {
      console.error(kleur.red(`✗ template path does not exist: ${src}`));
      process.exit(1);
    }
    console.log(kleur.dim(`▸ copying template from ${src}…`));
    cpSync(src, targetDir, {
      recursive: true,
      filter: (p) =>
        !/[/\\](node_modules|\.next|data|dist)([/\\]|$)/.test(p),
    });
  } else {
    const spec = flags.template || DEFAULT_TEMPLATE;
    console.log(kleur.dim(`▸ cloning ${spec}…`));
    await degit(spec, { cache: false, force: true }).clone(targetDir);
  }

  console.log(kleur.dim('▸ writing site.config.ts…'));
  writeSiteConfig(targetDir, { siteName, githubUrl, theme });

  console.log(kleur.dim('▸ writing package.json…'));
  rewritePackageJson(targetDir, { targetName, deployTarget });

  if (!samples) {
    console.log(kleur.dim('▸ stripping demo content…'));
    stripSampleContent(targetDir, { siteName });
  }

  if (deployTarget === 'cloudflare') {
    console.log(kleur.dim('▸ wiring Cloudflare config (D1 + R2)…'));
    wireCloudflare(targetDir);
  }

  if (!flags.noInstall) {
    const cmd = pmInstallCmd(pm);
    console.log(kleur.dim(`▸ installing dependencies… (${cmd})`));
    try {
      execSync(cmd, { cwd: targetDir, stdio: 'inherit' });
    } catch {
      console.error(
        kleur.yellow(
          `⚠ \`${cmd}\` failed. Run it manually after fixing the issue.`,
        ),
      );
    }
  }

  console.log(`\n${kleur.green('✓ done')}\n`);
  console.log('Next steps:');
  console.log(`  cd ${targetName}`);
  if (flags.noInstall) console.log(`  ${pmInstallCmd(pm)}`);
  if (deployTarget === 'cloudflare') {
    console.log('  npx wrangler login');
    console.log('  npx doks deploy:cloudflare   # D1 + R2 + configs + token prompt');
    console.log(`  ${pmRunCmd(pm, 'dev')}`);
  } else {
    console.log(`  ${pmRunCmd(pm, 'dev')}            # auto-runs ingest on first run`);
  }
}

function writeSiteConfig(target, { siteName, githubUrl, theme }) {
  const path = join(target, 'lib/site.config.ts');
  if (!existsSync(path)) {
    console.warn(
      kleur.yellow(
        `⚠ ${path} not found in template. Skipping config rewrite`,
      ),
    );
    return;
  }
  const src = readFileSync(path, 'utf8');
  const next = src
    .replace(/siteName: ["'].*?["']/, `siteName: ${quote(siteName)}`)
    .replace(/logoText: ["'].*?["']/, `logoText: ${quote(siteName)}`)
    .replace(/githubUrl: ["'].*?["']/, `githubUrl: ${quote(githubUrl)}`)
    .replace(/ctaUrl: ["'].*?["']/, `ctaUrl: ${quote(githubUrl)}`)
    .replace(/defaultTheme: ["'].*?["']/, `defaultTheme: ${quote(theme)}`);
  writeFileSync(path, next);
}

function rewritePackageJson(target, { targetName, deployTarget }) {
  const path = join(target, 'package.json');
  if (!existsSync(path)) return;
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.name = slugify(basename(targetName));
  pkg.private = true;
  if (pkg.dependencies && pkg.dependencies['doks-core'] === '*') {
    pkg.dependencies['doks-core'] = 'latest';
  }
  if (pkg.scripts && typeof pkg.scripts.ingest === 'string') {
    // Repoint at the published path; keep tsx as the runtime so the
    // dynamic import of `lib/doks.config.ts` works without compiling.
    pkg.scripts.ingest = pkg.scripts.ingest.replace(
      /\.\.\/\.\.\/packages\/doks-core\/(?:src|dist)\/scripts\/ingest\.(?:ts|js)/,
      'node_modules/doks-core/dist/scripts/ingest.js',
    );
    if (!pkg.scripts.ingest.startsWith('tsx ')) {
      pkg.scripts.ingest = `tsx ${pkg.scripts.ingest.replace(/^node\s+/, '')}`;
    }
  }

  if (deployTarget === 'cloudflare') {
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies['@cloudflare/workers-types'] =
      pkg.devDependencies['@cloudflare/workers-types'] || 'latest';
    pkg.devDependencies['@opennextjs/cloudflare'] =
      pkg.devDependencies['@opennextjs/cloudflare'] || 'latest';
    pkg.devDependencies['wrangler'] =
      pkg.devDependencies['wrangler'] || 'latest';
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.deploy =
      pkg.scripts.deploy ||
      'opennextjs-cloudflare build && opennextjs-cloudflare deploy';
    // The SQLite ensure-index step is meaningless on D1; the content
    // generator (`doks build:content`) is still required so the doc
    // pages can render without filesystem reads on the edge.
    if (typeof pkg.scripts.predev === 'string') {
      pkg.scripts.predev = pkg.scripts.predev
        .replace(/\s*&&\s*doks\s+ensure-index/, '')
        .replace(/doks\s+ensure-index\s*&&\s*/, '')
        .trim();
      if (!pkg.scripts.predev) delete pkg.scripts.predev;
    }
  }

  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}

const D1_RUNTIME_CONFIG_TEMPLATE = `// Vector-store configuration. Both the search route and the ingest CLI
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

const D1_INGEST_CONFIG_TEMPLATE = `// Node-side ingest config. Talks to the Cloudflare D1 REST API directly,
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

function wireCloudflare(target) {
  // Swap lib/doks.config.ts to D1 thunk.
  const runtimePath = join(target, 'lib', 'doks.config.ts');
  if (existsSync(runtimePath)) {
    writeFileSync(runtimePath, D1_RUNTIME_CONFIG_TEMPLATE);
  }

  // Add the Node-side ingest config.
  const ingestPath = join(target, 'lib', 'doks.config.ingest.ts');
  if (!existsSync(ingestPath)) {
    writeFileSync(ingestPath, D1_INGEST_CONFIG_TEMPLATE);
  }

  // Uncomment the OpenNext dev hook in next.config.mjs.
  const nextPath = join(target, 'next.config.mjs');
  if (existsSync(nextPath)) {
    const src = readFileSync(nextPath, 'utf8');
    const next = src.replace(
      /\/\/\s*import\s+\{\s*initOpenNextCloudflareForDev\s*\}\s+from\s+'@opennextjs\/cloudflare';\s*\n\/\/\s*initOpenNextCloudflareForDev\(\);/,
      `import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';\ninitOpenNextCloudflareForDev();`,
    );
    if (next !== src) writeFileSync(nextPath, next);
  }

  // Drop the SQLite predev hook (D1 ingest is opt-in via DOKS_CONFIG).
  // Already handled by rewritePackageJson when deployTarget=cloudflare.
}

function stripSampleContent(target, { siteName }) {
  const docsDir = join(target, 'content', 'docs');
  if (existsSync(docsDir)) {
    rmSync(docsDir, { recursive: true, force: true });
  }
  mkdirSync(docsDir, { recursive: true });

  const safeName = siteName.replace(/`/g, '');
  writeFileSync(
    join(docsDir, 'index.mdx'),
    `---
title: "Welcome"
description: "Replace this with a description of your project."
chunk_id: "docs-welcome"
order: 0
vector_metadata:
  importance: 0.9
---

Welcome to ${safeName}. This is the home page of your docs.

Add \`.mdx\` files under \`content/docs/\` and re-run \`npm run ingest\` to
update the search index. Wrap retrievable sections in \`<Chunk id="...">\`
to make them addressable by the chat panel and the \`/api/docs/search\`
endpoint.

For component examples and authoring patterns, browse the
[doks live demo](https://github.com/getdoks/doks).
`,
  );
}

function quote(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'doks-site';
}

main().catch((e) => {
  console.error(kleur.red(String(e?.stack || e)));
  process.exit(1);
});
