// Build-time content generator. Walks the consumer's `content/docs/` tree,
// compiles each MDX file to an ESM module via @mdx-js/mdx, writes one
// `.mjs` per doc into `<consumer>/.doks/compiled/`, then emits
// `lib/doks-content.gen.ts` with static imports of every compiled module
// plus their frontmatter.
//
// Why precompile? Cloudflare Workers (and any V8-isolate runtime) block
// `eval` and `new Function`. The 0.3.0–0.3.2 generator shipped raw MDX
// source and let `next-mdx-remote/rsc` compile at request time — works
// on Node, throws `EvalError: Code generation from strings disallowed`
// on Workers. Precompiling at build time and statically importing the
// result lets the worker serve doc pages without any runtime parsing.
//
// Output:
//   <consumer>/lib/doks-content.gen.ts        # registers map (this file is gitignored)
//   <consumer>/.doks/compiled/index.mjs        # compiled root
//   <consumer>/.doks/compiled/<slug>.mjs       # compiled doc per slug
//
// The `.doks/compiled/` directory is also gitignored.

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

import { CONTENT_SCHEMA_VERSION } from '../runtime/content';
import type { DocFrontmatter } from '../lib/docs';
import { rehypeJsxHeadingSlugs } from '../lib/rehypeJsxHeadingSlugs';

export interface BuildContentOptions {
  /** Project root. Defaults to `process.cwd()`. */
  root?: string;
  /** Path (relative to `root`) to the docs corpus. Defaults to `content/docs`. */
  docsDir?: string;
  /** Path (relative to `root`) to write the generated module. Defaults to `lib/doks-content.gen.ts`. */
  outFile?: string;
  /**
   * Path (relative to `root`) where compiled per-doc modules go.
   * Defaults to `.doks/compiled`. Should be gitignored.
   */
  compiledDir?: string;
  /** Suppress stdout. Default `false`. */
  silent?: boolean;
}

interface CapturedDoc {
  slug: string[];
  href: string;
  frontmatter: DocFrontmatter;
  raw: string;
  body: string;          // MDX body (frontmatter stripped) — what we compile
  filePath: string;
  /** Filesystem-safe filename for the compiled .mjs (no extension). */
  safeName: string;
}

function walkMdx(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMdx(full, files);
    else if (/\.mdx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

function fileToSlug(filePath: string, docsDir: string): string[] {
  const rel = path.relative(docsDir, filePath);
  const noExt = rel.replace(/\.(md|mdx)$/, '');
  const parts = noExt.split(path.sep);
  if (parts[parts.length - 1] === 'index') parts.pop();
  return parts;
}

function slugToSafeName(slug: string[]): string {
  if (slug.length === 0) return 'index';
  return slug
    .map((s) => s.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .join('--');
}

async function compileMdxBody(body: string): Promise<string> {
  // outputFormat: 'program' produces a real ES module: `export default …`
  // jsxRuntime: 'automatic' uses react/jsx-runtime, no `import React from "react"` needed.
  // Plugins run at compile time so the resulting JS contains no MDX/markdown — pure JSX → JS.
  const compiled = await compile(body, {
    outputFormat: 'program',
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    development: false,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      rehypeJsxHeadingSlugs,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
  });
  return String(compiled);
}

export async function buildContent(
  options: BuildContentOptions = {},
): Promise<{ docs: number; outFile: string }> {
  const root = options.root ?? process.cwd();
  const docsDir = path.resolve(root, options.docsDir ?? 'content/docs');
  const outFile = path.resolve(root, options.outFile ?? 'lib/doks-content.gen.ts');
  const compiledDir = path.resolve(root, options.compiledDir ?? '.doks/compiled');
  const log = options.silent ? () => {} : (m: string) => console.log(m);

  log('▸ doks build:content');
  log(`  docs:     ${path.relative(root, docsDir) || '.'}`);
  log(`  output:   ${path.relative(root, outFile) || '.'}`);
  log(`  compiled: ${path.relative(root, compiledDir) || '.'}`);

  if (!fs.existsSync(docsDir)) {
    log(`  ⚠ docs directory not found, writing empty content map`);
  }

  const files = walkMdx(docsDir);

  // First pass: parse frontmatter + slug, plan filenames, dedupe collisions.
  const captured: CapturedDoc[] = [];
  const usedNames = new Set<string>();
  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content: body } = matter(raw);
    const slug = fileToSlug(filePath, docsDir);
    let safeName = slugToSafeName(slug);
    if (usedNames.has(safeName)) {
      // Disambiguate with a counter. Rare — would only happen if two
      // distinct slugs collapse to the same sanitized name.
      let n = 2;
      while (usedNames.has(`${safeName}-${n}`)) n++;
      safeName = `${safeName}-${n}`;
    }
    usedNames.add(safeName);
    captured.push({
      slug,
      href: '/docs' + (slug.length ? '/' + slug.join('/') : ''),
      frontmatter: data as DocFrontmatter,
      raw,
      body,
      filePath,
      safeName,
    });
  }

  // Second pass: compile each MDX to ESM and write to disk.
  fs.rmSync(compiledDir, { recursive: true, force: true });
  fs.mkdirSync(compiledDir, { recursive: true });

  for (const c of captured) {
    let compiled: string;
    try {
      compiled = await compileMdxBody(c.body);
    } catch (err) {
      log(
        `  ✗ compile failed: ${path.relative(root, c.filePath)}\n` +
          `    ${(err as Error).message}`,
      );
      throw err;
    }
    const outPath = path.join(compiledDir, `${c.safeName}.mjs`);
    fs.writeFileSync(outPath, compiled);
  }

  // Read root meta.
  const metaPath = path.join(docsDir, '_meta.json');
  let rootMeta: Record<string, unknown> = {};
  if (fs.existsSync(metaPath)) {
    try {
      rootMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (err) {
      log(`  ⚠ failed to parse ${metaPath}: ${(err as Error).message}`);
    }
  }

  // Emit the gen file. Static imports of every compiled .mjs (so a
  // bundler can resolve them) plus a setContentMap call wiring slugs +
  // frontmatter + Component refs.
  const importLines: string[] = [];
  const docEntries: string[] = [];

  // Compute the import path from the gen file's directory to the
  // compiled dir, so the bundler can resolve regardless of how the
  // consumer arranges things.
  const genDir = path.dirname(outFile);
  const compiledRel = path
    .relative(genDir, compiledDir)
    .split(path.sep)
    .join('/'); // posix separators for the import specifier

  captured.forEach((c, i) => {
    const importSpec = `${compiledRel}/${c.safeName}.mjs`;
    // Use `./` prefix when the relative path doesn't already start with one.
    const finalSpec = importSpec.startsWith('.') ? importSpec : `./${importSpec}`;
    importLines.push(`import * as Doc${i} from "${finalSpec}";`);
    docEntries.push(
      `  { slug: ${JSON.stringify(c.slug)}, ` +
        `href: ${JSON.stringify(c.href)}, ` +
        `frontmatter: ${JSON.stringify(c.frontmatter)}, ` +
        `raw: ${JSON.stringify(c.raw)}, ` +
        `Component: Doc${i}.default, ` +
        `filePath: ${JSON.stringify(c.filePath)} },`,
    );
  });

  const body =
    `// AUTO-GENERATED by \`doks build:content\`. Do not edit.\n` +
    `// Re-runs on \`predev\` and \`prebuild\`; see your package.json.\n` +
    `\n` +
    `import { setContentMap } from "doks-core/runtime/content";\n` +
    importLines.join('\n') +
    (importLines.length ? '\n' : '') +
    `\n` +
    `setContentMap({\n` +
    `  schemaVersion: ${CONTENT_SCHEMA_VERSION},\n` +
    `  docs: [\n` +
    docEntries.join('\n') +
    (docEntries.length ? '\n' : '') +
    `  ],\n` +
    `  rootMeta: ${JSON.stringify(rootMeta)},\n` +
    `});\n` +
    `\n` +
    `export {};\n`;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, body);

  log(`  ✓ compiled ${captured.length} doc(s)`);
  return { docs: captured.length, outFile };
}

export interface WatchContentOptions extends BuildContentOptions {
  /** Debounce window in ms before re-running the generator. Default 100ms. */
  debounceMs?: number;
}

/**
 * Long-running variant: builds once, then watches the docs directory and
 * regenerates on every MDX/_meta.json change. Returns a function that
 * stops the watcher (close the chokidar instance, exit cleanly).
 *
 * Used by `doks build:content --watch`. Pair with Next's HMR for the
 * full edit→reload loop: this regenerates `lib/doks-content.gen.ts`,
 * which is in Next's module graph (imported from `app/layout.tsx`),
 * so Next picks up the change and reloads.
 */
export async function watchContent(
  options: WatchContentOptions = {},
): Promise<() => Promise<void>> {
  const root = options.root ?? process.cwd();
  const docsDir = path.resolve(root, options.docsDir ?? 'content/docs');
  const debounceMs = options.debounceMs ?? 100;
  const log = options.silent ? () => {} : (m: string) => console.log(m);

  // Initial build before watching so the dev server has a populated map
  // immediately on first request.
  await buildContent(options);

  // Lazy-load chokidar so the non-watch path doesn't pay the cost.
  const { default: chokidar } = await import('chokidar');

  const watcher = chokidar.watch(docsDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 30 },
    ignored: (p, stats) =>
      !!stats?.isFile() && !/\.(md|mdx|json)$/.test(p),
  });

  let pending: NodeJS.Timeout | null = null;
  let inFlight = false;
  let queued = false;

  const run = async () => {
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;
    const start = Date.now();
    try {
      await buildContent({ ...options, silent: true });
      log(`▸ build:content (${Date.now() - start}ms)`);
    } catch (err) {
      console.error('build:content failed:', (err as Error).message);
    } finally {
      inFlight = false;
      if (queued) {
        queued = false;
        run();
      }
    }
  };

  const schedule = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(run, debounceMs);
  };

  watcher.on('all', (event, file) => {
    // Only react to source files; chokidar's ignore filter already cuts
    // most noise, but double-check here for the directory-level events.
    if (
      event === 'add' ||
      event === 'change' ||
      event === 'unlink' ||
      event === 'addDir' ||
      event === 'unlinkDir'
    ) {
      if (file && /\.(md|mdx|json)$/.test(file)) {
        schedule();
      } else if (event === 'addDir' || event === 'unlinkDir') {
        // Directory changes can affect the content map even without a
        // file event firing.
        schedule();
      }
    }
  });

  log(`▸ watching ${path.relative(root, docsDir) || '.'} for changes…`);

  return async () => {
    if (pending) clearTimeout(pending);
    await watcher.close();
  };
}

// CLI entrypoint.
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  /scripts[\\/]buildContent\.[mc]?[jt]s$/.test(process.argv[1]);

if (isMain) {
  const argv = process.argv.slice(2);
  const watch = argv.includes('--watch') || argv.includes('-w');
  if (watch) {
    watchContent()
      .then((stop) => {
        const shutdown = async () => {
          await stop();
          process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      })
      .catch((err) => {
        console.error('build:content --watch failed:', err);
        process.exit(1);
      });
  } else {
    buildContent().catch((err) => {
      console.error('build:content failed:', err);
      process.exit(1);
    });
  }
}
