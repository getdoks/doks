# doks-core

[![npm](https://img.shields.io/npm/v/doks-core.svg)](https://www.npmjs.com/package/doks-core)
[![license](https://img.shields.io/npm/l/doks-core.svg)](https://github.com/getdoks/doks/blob/main/LICENSE)

Framework engine for **[doks](https://github.com/getdoks/doks)**, an open-source
RAG-optimized documentation site on Next.js + MDX. Bring your own keys, no
SaaS layer, no telemetry.

This package ships:

- React components (`<DocsShell>`, `<Header>`, `<LeftSidebar>`, `<Spotlight>`, `<RightRail>`)
- MDX components (`<Hero>`, `<Callout>`, `<QJump>`, `<Steps>`, `<Tabs>`, `<Figure>`, …)
- The page renderer (`DocPage` for `/docs/[[...slug]]`), the search route factory, the 404 / error boundaries
- A pluggable `VectorStore` contract with three adapters out of the box: SQLite (default), D1 (in-Worker), D1 over the Cloudflare REST API (for Node-side ingest)
- An ingest script that walks `content/docs/`, embeds chunks, and writes to whichever store is configured
- The `doks` CLI: `upgrade`, `d1:init`, `setup-cloudflare`

## Quick start

The fast path: don't install this directly, scaffold a project that uses it.

```bash
npx create-doks my-docs
cd my-docs
npm run ingest    # builds data/docs.db
npm run dev       # http://localhost:3000
```

That gives you a working Next.js + MDX docs site with `doks-core` already
wired up.

## Manual install

If you're grafting doks onto an existing Next.js app:

```bash
npm install doks-core
```

Then add it to `next.config.mjs`:

```js
const nextConfig = {
  transpilePackages: ['doks-core'],
  serverExternalPackages: ['better-sqlite3', 'sqlite-vec'],
};
export default nextConfig;
```

Import the styles from your global stylesheet:

```css
/* app/globals.css */
@import 'doks-core/styles.css';
```

Pick a vector-store adapter in `lib/doks.config.ts`:

```ts
// lib/doks.config.ts
import { createSqliteStore } from 'doks-core/adapters/sqlite';
import type { VectorStore } from 'doks-core';

export const vectorStore: VectorStore = createSqliteStore({
  path: 'data/docs.db',
});
```

Wire the routes:

```ts
// app/docs/[[...slug]]/page.tsx
import { DocPage } from 'doks-core';
export { generateStaticParams, generateMetadata } from 'doks-core';
export default DocPage;
```

```ts
// app/api/docs/search/route.ts
import { createSearchHandler } from 'doks-core';
import { vectorStore } from '@/lib/doks.config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const { POST, GET } = createSearchHandler(vectorStore);
```

Run the ingest script to build the index:

```bash
npm pkg set scripts.ingest='tsx node_modules/doks-core/dist/scripts/ingest.js'
npm run ingest
```

For a complete walkthrough see the
[install docs](https://github.com/getdoks/doks/blob/main/apps/site/content/docs/getting-started/install.mdx).

## CLI

The package installs a `doks` bin:

```bash
npx doks upgrade                  # bump doks-core, run pending migrations
npx doks upgrade --dry-run        # preview without applying
npx doks d1:init                  # print the D1 chunks-table schema (stdout)
npx doks d1:init --remote <db>    # run the schema against a remote D1
npx doks d1:init --local <db>     # run against a local D1
npx doks setup-cloudflare         # one-shot: create D1 + R2, run schema,
                                  # print a wrangler.jsonc snippet
npx doks --help
```

`setup-cloudflare` accepts `--worker`, `--db`, `--bucket` overrides and
`--skip-d1`, `--skip-r2`, `--skip-schema` to provision a subset.

Run from inside a project that has `doks-core` as a dependency.

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `>= 20` | Next 15 requires `^18.18 \|\| ^19.8 \|\| >=20`. doks targets 20. |
| npm | bundled | Any recent version with workspace support. |
| C toolchain | platform-specific | Only needed for the SQLite adapter (`better-sqlite3` ships native bindings). macOS: `xcode-select --install`. Debian/Ubuntu: `sudo apt-get install -y build-essential`. Windows: use WSL. D1-only deployments don't need a C toolchain. |
| `wrangler`, `@opennextjs/cloudflare`, `@cloudflare/workers-types` | latest | Optional. Only needed for Cloudflare D1 deployments. Listed as optional peer deps. |

## What's in the tarball

```
dist/             compiled JS + .d.ts (entry: dist/index.js)
src/styles/       CSS bundles, imported via 'doks-core/styles.css'
bin/doks.js       the `doks` CLI
migrations/       one-shot scripts run by `doks upgrade`
LICENSE
README.md
```

## Public API

Everything exported from `dist/index.d.ts` is the stable surface. Anything not
exported there is internal and may change between versions.

Subpath exports keep heavy or platform-specific code out of consumer bundles
(notably: the SQLite adapter pulls `better-sqlite3`, so it lives under a
subpath and never ships to edge runtimes through the top-level barrel):

| Subpath | Use for |
| --- | --- |
| `doks-core` | Top-level barrel: components, types, `createSearchHandler`, `VectorStore` |
| `doks-core/styles.css` | Framework CSS (`@import` from your `globals.css`) |
| `doks-core/adapters/sqlite` | `createSqliteStore({ path })`. Node only. |
| `doks-core/adapters/d1` | `createD1Store(D1Database)`. Edge-safe; pair with `getCloudflareContext()`. |
| `doks-core/adapters/d1/http` | `createD1HttpStore({ accountId, databaseId, apiToken })`. Node-side ingest into remote D1 over the Cloudflare REST API. |
| `doks-core/cloudflare/open-next` | Default OpenNext config that wires the R2 incremental cache. Re-export from `open-next.config.ts`. |
| `doks-core/api/search` | Pre-built search route handler (legacy; prefer `createSearchHandler`) |
| `doks-core/not-found` | The branded 404 page |
| `doks-core/error` | Runtime error boundary (use as `app/error.tsx`) |
| `doks-core/global-error` | Root-layout-crash boundary (use as `app/global-error.tsx`) |
| `doks-core/scripts/ingest` | The ingest script (`tsx node_modules/doks-core/dist/scripts/ingest.js`) |
| `doks-core/mdx-components` | Pre-registered MDX components map |

## Cloudflare deployment (D1 + R2)

doks-core has first-class support for Cloudflare Workers via D1 (vectors)
and R2 (OpenNext incremental cache). The fast path:

```bash
npm install -D @cloudflare/workers-types @opennextjs/cloudflare wrangler
npx wrangler login
npx doks setup-cloudflare        # creates D1 + R2, runs schema,
                                 # prints wrangler.jsonc snippet
```

Then in your project:

```ts
// open-next.config.ts
export { default } from 'doks-core/cloudflare/open-next';
```

```ts
// lib/doks.config.ts (runtime — Worker)
import { createD1Store } from 'doks-core/adapters/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { VectorStore } from 'doks-core';

export const vectorStore = (): VectorStore =>
  createD1Store(getCloudflareContext().env.DB);
```

```ts
// lib/doks.config.ingest.ts (Node — only used by the ingest CLI)
import { createD1HttpStore } from 'doks-core/adapters/d1/http';
import type { VectorStore } from 'doks-core';

export const vectorStore: VectorStore = createD1HttpStore({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});
```

```bash
DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest
npm run deploy
```

Full walkthrough: [Deployment guide](https://github.com/getdoks/doks/blob/main/apps/site/content/docs/guides/deployment.mdx).

## Versioning

Semver. Public API breaks bump the minor pre-1.0 (or major post-1.0) and ship
with a migration script under `migrations/<target-version>.js` that
`doks upgrade` runs automatically. See
[`migrations/README.md`](https://github.com/getdoks/doks/tree/main/packages/doks-core/migrations)
for the policy if you're contributing a breaking change.

## Links

- **Full docs**: https://github.com/getdoks/doks
- **Issues**: https://github.com/getdoks/doks/issues
- **Scaffold CLI**: [`create-doks`](https://www.npmjs.com/package/create-doks)

## License

MIT. See [LICENSE](https://github.com/getdoks/doks/blob/main/LICENSE).
