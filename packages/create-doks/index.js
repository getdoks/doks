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
const DEFAULT_TEMPLATE = 'getdoks/doks#v0.2.2/apps/site';
const THEMES = ['light', 'dark', 'blue-pearl', 'sand'];

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
    else if (a.startsWith('--')) {
      console.error(kleur.red(`Unknown flag: ${a}`));
      process.exit(2);
    } else {
      args.positional.push(a);
    }
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
  --no-install           skip 'npm install' after scaffolding
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

  const target = resolve(targetName);
  if (existsSync(target) && readdirSync(target).length > 0) {
    console.error(kleur.red(`✗ ${target} already exists and is not empty.`));
    process.exit(1);
  }
  mkdirSync(target, { recursive: true });

  if (flags.templatePath) {
    const src = resolve(flags.templatePath);
    if (!existsSync(src)) {
      console.error(kleur.red(`✗ template path does not exist: ${src}`));
      process.exit(1);
    }
    console.log(kleur.dim(`▸ copying template from ${src}…`));
    cpSync(src, target, {
      recursive: true,
      filter: (p) =>
        !/[/\\](node_modules|\.next|data|dist)([/\\]|$)/.test(p),
    });
  } else {
    const spec = flags.template || DEFAULT_TEMPLATE;
    console.log(kleur.dim(`▸ cloning ${spec}…`));
    await degit(spec, { cache: false, force: true }).clone(target);
  }

  console.log(kleur.dim('▸ writing site.config.ts…'));
  writeSiteConfig(target, { siteName, githubUrl, theme });

  console.log(kleur.dim('▸ writing package.json…'));
  rewritePackageJson(target, { targetName });

  if (!samples) {
    console.log(kleur.dim('▸ stripping demo content…'));
    stripSampleContent(target, { siteName });
  }

  if (!flags.noInstall) {
    console.log(kleur.dim('▸ installing dependencies…'));
    try {
      execSync('npm install', { cwd: target, stdio: 'inherit' });
    } catch {
      console.error(
        kleur.yellow(
          '⚠ npm install failed. Run it manually after fixing the issue.',
        ),
      );
    }
  }

  console.log(`\n${kleur.green('✓ done')}\n`);
  console.log('Next steps:');
  console.log(`  cd ${targetName}`);
  if (flags.noInstall) console.log('  npm install');
  console.log('  npm run ingest');
  console.log('  npm run dev');
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

function rewritePackageJson(target, { targetName }) {
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
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
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
