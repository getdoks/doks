# doks-core

Framework engine for [doks](https://github.com/getdoks/doks). An
open-source, RAG-optimized documentation site on Next.js + MDX.

This package ships the React components, MDX renderer, ingest script, and
SQLite + sqlite-vec data layer. It is consumed by the `apps/site` template
(scaffold a new project with `npx create-doks`).

## Install

```bash
npm install doks-core
```

You typically don't install this directly. Run `npx create-doks my-docs`;
the scaffold wires it up for you.

## CLI

```
doks upgrade [--dry-run]   Bump to the latest doks-core and run pending
                            migrations. Run inside your project directory.
doks --help                 Show help.
```

## What's in the package

```
dist/                  compiled output (entry: dist/index.js)
src/styles/            CSS bundles (imported via 'doks-core/styles.css')
bin/doks.js            'doks upgrade' CLI
migrations/            one-shot scripts for breaking changes
```

## Public API

See `dist/index.d.ts`. Anything not exported there is internal.

License: MIT.
