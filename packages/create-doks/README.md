# create-doks

[![npm](https://img.shields.io/npm/v/create-doks.svg)](https://www.npmjs.com/package/create-doks)
[![license](https://img.shields.io/npm/l/create-doks.svg)](https://github.com/getdoks/doks/blob/main/LICENSE)

Scaffold a new **[doks](https://github.com/getdoks/doks)** documentation site
in one command. doks is an open-source, RAG-optimized docs framework on
Next.js + MDX with built-in vector retrieval. Bring your own keys, no SaaS
layer, no telemetry.

## Usage

```bash
npx create-doks my-docs
```

You'll be prompted for:

- **Project directory** (e.g. `my-docs`)
- **Site name** (used in the header logo and `<title>` template)
- **GitHub repo URL** (header link, CTA target)
- **Default theme** (`light` / `dark` / `blue-pearl` / `sand`)
- **Keep the demo MDX content?** Yes for a learning reference; no (default) for a clean slate

The CLI then:

1. Clones the [`apps/site`](https://github.com/getdoks/doks/tree/main/apps/site) template via `degit`.
2. Rewrites `lib/site.config.ts` with your answers.
3. Rewrites `package.json` (slugged name, `doks-core: "latest"`).
4. Strips the demo MDX content if you opted out.
5. Runs `npm install`.

After it finishes:

```bash
cd my-docs
npm run ingest   # build the embedding index
npm run dev      # http://localhost:3000
```

## Flags

| Flag | Effect |
| --- | --- |
| `--samples` | Keep the full demo MDX corpus (component galleries, archetypes, getting-started, reference, guides). |
| `--no-samples` | Strip the demo content; start with a single `index.mdx`. (default) |
| `--no-install` | Skip `npm install` after scaffolding. |
| `-y`, `--yes` | Accept all defaults; useful for non-interactive scripts. |
| `--template <spec>` | Use a different `degit` spec (default `getdoks/doks#v0.2.0/apps/site`, pinned to the tag matching this CLI version). |
| `--template-path <dir>` | Copy from a local directory instead of cloning (used in CI / dev). |
| `-h`, `--help` | Show usage. |

## Requirements

- **Node.js ≥ 20** (Next 15, which doks ships, requires `^18.18 || ^19.8 || >=20`).
- **npm** (any recent version).
- A C toolchain so `better-sqlite3` can build its native bindings:
  - macOS: `xcode-select --install`
  - Debian/Ubuntu: `sudo apt-get install -y build-essential`
  - Windows: WSL is the path of least resistance.

If `node -v` returns less than `v20.0.0`, install or switch first:

```bash
nvm install 20 && nvm use 20
```

## What you get

After the CLI runs, your project looks like this:

```
my-docs/
├── app/                       # thin Next.js wrappers
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── api/docs/search/route.ts
│   └── docs/[[...slug]]/page.tsx
├── content/docs/
│   └── index.mdx              # your home page (or full demo corpus if you kept samples)
├── lib/site.config.ts         # brand + theme config
├── public/
│   ├── favicon.svg
│   ├── logo.svg
│   └── logo-dark.svg
├── next.config.mjs
├── postcss.config.mjs
├── tsconfig.json
└── package.json               # depends on doks-core@latest
```

Edit `content/docs/*.mdx` to write docs. Edit `lib/site.config.ts` to change
branding. Re-run `npm run ingest` whenever you change MDX. Standard cycle.

## Upgrading later

When `doks-core` ships a new version:

```bash
npx doks upgrade
```

Bumps `doks-core` and runs any pending migration scripts that adapt your
project to the new release. See
[Upgrade docs](https://github.com/getdoks/doks/blob/main/apps/site/content/docs/getting-started/upgrade.mdx)
for the full flow.

## Links

- **Full docs**: https://github.com/getdoks/doks
- **Framework package**: [`doks-core`](https://www.npmjs.com/package/doks-core)
- **Issues**: https://github.com/getdoks/doks/issues

## License

MIT. See [LICENSE](https://github.com/getdoks/doks/blob/main/LICENSE).
