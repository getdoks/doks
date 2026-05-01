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

### Requirements

- **Node.js ≥ 20** (Next 15 requires `^18.18.0 || ^19.8.0 || >= 20.0.0`;
  doks itself targets 20 so the workspace uses one consistent version).
- **npm** (any recent version that supports workspaces).
- A C toolchain for `better-sqlite3` to build native bindings:
  - macOS: `xcode-select --install`
  - Debian/Ubuntu: `sudo apt-get install -y build-essential`
  - Windows: WSL is the path of least resistance.

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
