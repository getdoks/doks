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
- **Deploy target?** `vercel` (Node + SQLite, default) or `cloudflare` (Workers + D1 + R2)

The CLI then:

1. Clones the [`apps/site`](https://github.com/getdoks/doks/tree/main/apps/site) template via `degit`.
2. Rewrites `lib/site.config.ts` with your answers.
3. Rewrites `package.json` (slugged name, `doks-core: "latest"`).
4. Strips the demo MDX content if you opted out.
5. If you picked Cloudflare: swaps `lib/doks.config.ts` to the D1 thunk,
   writes `lib/doks.config.ingest.ts`, uncomments the OpenNext dev hook,
   and adds the Cloudflare peer deps (`@cloudflare/workers-types`,
   `@opennextjs/cloudflare`, `wrangler`) to `devDependencies`.
6. Runs `npm install`.

After it finishes (Vercel/Node):

```bash
cd my-docs
npm run dev          # auto-runs ingest on first run via predev hook
```

After it finishes (Cloudflare):

```bash
cd my-docs
npx wrangler login
npx doks deploy:cloudflare    # provisions D1 + R2, prompts for API token
npm run dev
```

## Flags

| Flag | Effect |
| --- | --- |
| `--samples` | Keep the full demo MDX corpus (component galleries, archetypes, getting-started, reference, guides). |
| `--no-samples` | Strip the demo content; start with a single `index.mdx`. (default) |
| `--target <host>` | Deploy target: `vercel` (Node + SQLite, default) or `cloudflare` (Workers + D1 + R2). Skips the prompt. |
| `--no-install` | Skip `npm install` after scaffolding. |
| `-y`, `--yes` | Accept all defaults; useful for non-interactive scripts. |
| `--template <spec>` | Use a different `degit` spec (default `getdoks/doks#v0.3.2/apps/site`, pinned to the tag matching this CLI version). |
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
├── lib/
│   ├── site.config.ts         # brand + theme config
│   └── doks.config.ts         # vector-store adapter (SQLite by default)
├── public/
│   ├── favicon.svg
│   ├── logo.svg
│   └── logo-dark.svg
├── next.config.mjs            # transpile + serverExternalPackages, with
│                              # commented OpenNext dev hook for D1 setups
├── open-next.config.ts        # one-line re-export from doks-core/cloudflare/open-next
├── postcss.config.mjs
├── tsconfig.json
└── package.json               # depends on doks-core@latest
```

Edit `content/docs/*.mdx` to write docs. Edit `lib/site.config.ts` to change
branding. Re-run `npm run ingest` whenever you change MDX. Standard cycle.

## Deploying

The default SQLite adapter works on any Node host (Vercel, Netlify, Railway,
Render, Docker). For Cloudflare Workers, scaffold with `--target cloudflare`
(or pick it at the prompt) — the configs are pre-wired. Then:

```bash
npx wrangler login
npx doks deploy:cloudflare     # one shot: D1 + R2 + configs + token prompt
DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest
npm run deploy
```

If you scaffolded as Vercel and want to migrate to Cloudflare later,
`doks deploy:cloudflare` mutates the configs in place. See the
[Deployment guide](https://github.com/getdoks/doks/blob/main/apps/site/content/docs/guides/deployment.mdx)
for the manual path and what the command actually does.

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
