# doks-core

[![npm](https://img.shields.io/npm/v/doks-core.svg)](https://www.npmjs.com/package/doks-core)
[![license](https://img.shields.io/npm/l/doks-core.svg)](https://github.com/getdoks/doks/blob/main/LICENSE)

Framework engine for **[doks](https://github.com/getdoks/doks)**, an open-source
RAG-optimized documentation site on Next.js + MDX. Bring your own keys, no
SaaS layer, no telemetry.

This package ships:

- React components (`<DocsShell>`, `<Header>`, `<LeftSidebar>`, `<Spotlight>`, `<RightRail>`)
- MDX components (`<Hero>`, `<Callout>`, `<QJump>`, `<Steps>`, `<Tabs>`, `<Figure>`, …)
- The page renderer (`DocPage` for `/docs/[[...slug]]`), the search route handler, the 404 / error boundaries
- An ingest script that walks `content/docs/`, embeds chunks, and writes a `sqlite-vec` index
- The `doks` CLI for upgrade + migration runs

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

Wire the routes (thin re-exports):

```ts
// app/docs/[[...slug]]/page.tsx
import { DocPage } from 'doks-core';
export { generateStaticParams, generateMetadata } from 'doks-core';
export default DocPage;
```

```ts
// app/api/docs/search/route.ts
export { POST, GET } from 'doks-core/api/search';
```

Run the ingest script to build the index:

```bash
npm pkg set scripts.ingest='node node_modules/doks-core/dist/scripts/ingest.js'
npm run ingest
```

For a complete walkthrough see the
[install docs](https://github.com/getdoks/doks/blob/main/apps/site/content/docs/getting-started/install.mdx).

## CLI

The package installs a `doks` bin:

```bash
npx doks upgrade            # bump doks-core, run pending migrations
npx doks upgrade --dry-run  # preview without applying
npx doks --help
```

Run from inside a project that has `doks-core` as a dependency.

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `>= 20` | Next 15 requires `^18.18 \|\| ^19.8 \|\| >=20`. doks targets 20. |
| npm | bundled | Any recent version with workspace support. |
| C toolchain | platform-specific | `better-sqlite3` ships native bindings. macOS: `xcode-select --install`. Debian/Ubuntu: `sudo apt-get install -y build-essential`. Windows: use WSL. |

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

Subpath exports for cases where you want to avoid pulling in the data layer:

| Subpath | Use for |
| --- | --- |
| `doks-core` | Top-level barrel with components, hooks, types |
| `doks-core/styles.css` | Framework CSS (`@import` from your `globals.css`) |
| `doks-core/api/search` | Re-export `POST` / `GET` for `/api/docs/search` |
| `doks-core/not-found` | The branded 404 page |
| `doks-core/error` | Runtime error boundary (use as `app/error.tsx`) |
| `doks-core/global-error` | Root-layout-crash boundary (use as `app/global-error.tsx`) |
| `doks-core/scripts/ingest` | The ingest script (don't import; invoke with `node`) |
| `doks-core/mdx-components` | Pre-registered MDX components map |

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
