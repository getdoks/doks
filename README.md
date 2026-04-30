# doks

**Open-source, RAG-optimized documentation framework on Next.js + MDX.**

doks is a Next.js + MDX docs framework with built-in vector retrieval. Bring
your own keys. No SaaS layer, no sign-up, no telemetry.

This repository is a workspace:

- `packages/doks-core`. Framework engine (published to npm).
- `packages/create-doks`. `npx create-doks` scaffold CLI.
- `apps/site`. The canonical consumer app (also the live demo).

If you want to *use* doks, run `npx create-doks my-docs` and ignore the rest of
this README. See [`packages/doks-core/README.md`](./packages/doks-core/README.md)
or the rendered docs at `/docs`. The README below is for working *on* doks
itself.

---

## Prerequisites

- **Node.js** ≥ 20
- **npm** (workspaces enabled)

---

## Quick start (workspace dev)

```bash
git clone https://github.com/getdoks/doks
cd doks
npm install
npm run ingest      # build apps/site/data/docs.db (74 chunks of demo content)
npm run dev         # http://localhost:3000
```

Root scripts delegate to the workspace:

| Script | What runs |
| --- | --- |
| `npm run dev` | `next dev` for `apps/site` |
| `npm run build` | `next build` for `apps/site` |
| `npm run start` | `next start` for `apps/site` |
| `npm run lint` | `next lint` for `apps/site` |
| `npm run ingest` | `tsx packages/doks-core/src/scripts/ingest.ts` (writes `apps/site/data/docs.db`) |
| `npm run typecheck` | `tsc --noEmit` for `doks-core` |
| `npm test` | runs `node --test` suites under `packages/*/test/` |

---

## Project structure

```
.
├── apps/
│   └── site/                       # consumer app (template body)
│       ├── app/                    # thin Next.js wrappers
│       ├── content/docs/           # demo MDX corpus
│       ├── lib/site.config.ts      # USER-owned brand config
│       ├── public/                 # static assets (light.svg, dark.svg)
│       ├── data/docs.db            # ingest output (gitignored)
│       └── package.json
├── packages/
│   ├── doks-core/                  # framework. Published to npm
│   │   ├── src/
│   │   │   ├── components/         # React components
│   │   │   ├── lib/                # docs / chunks / db / embed / theme
│   │   │   ├── pages/docPage.tsx   # the [[...slug]] renderer
│   │   │   ├── api/searchRoute.ts  # POST/GET /api/docs/search
│   │   │   ├── scripts/ingest.ts
│   │   │   └── styles/             # globals.css, themes.css
│   │   ├── bin/doks.js             # `doks upgrade` CLI
│   │   ├── migrations/             # X.Y.Z.js scripts
│   │   └── package.json
│   └── create-doks/                # `npx create-doks` CLI
│       ├── index.js
│       └── package.json
├── .github/workflows/ci.yml
├── .env.example
├── LICENSE
├── package.json                    # workspace root
└── README.md
```

---

## Authoring docs

Add `.mdx` files under `apps/site/content/docs/`. Each file requires
frontmatter:

```mdx
---
title: "Authentication"
category: "core-concepts"
tags: ["auth", "api-keys"]
vector_metadata:
  importance: 0.8
order: 2
---

<Chunk id="api-keys" importance={0.9}>
## API keys

Issue a key from the dashboard and pass it as
`Authorization: Bearer <key>` on every request.
</Chunk>
```

Wrap retrievable units in `<Chunk id="…">`. These become the rows in the
vector index. Re-run `npm run ingest` after editing MDX.

---

## Configuration

### Environment variables

Copy `.env.example` to `apps/site/.env` and set what you need. All vars are
optional for local dev (the deterministic hash embedder runs without a key):

| Variable | Required | Purpose |
| --- | --- | --- |
| `VOYAGE_API_KEY` | no | Embedding provider. Without it, falls back to a deterministic hash embedder (fine for dev, not prod retrieval). |
| `ANTHROPIC_API_KEY` | no | Chat provider for the "Ask the docs" panel. |
| `OPENAI_API_KEY` | no | Alternative chat / embedding provider. |
| `GEMINI_API_KEY` | no | Alternative chat provider. |

### Branding

Edit `apps/site/lib/site.config.ts`. Every visible string flows from this one
file. See [Site config reference](./apps/site/content/docs/reference/site-config.mdx).

### Themes

Edit `packages/doks-core/src/styles/themes.css` (workspace dev) or shadow it in
`apps/site/app/globals.css` (consumer override). Themes are CSS variable blocks
on `:root[data-theme="…"]`. Built-ins: `light`, `dark`, `blue-pearl`, `sand`.

---

## CLI

After publish, two CLIs are available:

```bash
npx create-doks my-docs       # scaffold a new project
npx doks upgrade              # bump doks-core + run pending migrations
                              # (run inside a doks project)
```

Until then, work from the workspace.

---

## Deployment

`apps/site` builds as a standard Next.js app. From the workspace root:

```bash
npm run build
```

The output is at `apps/site/.next`. The `/api/docs/search` route requires a
Node.js runtime (native `better-sqlite3` bindings). On Vercel:

```bash
cd apps/site && npx vercel --prod
```

Set env vars (`VOYAGE_API_KEY`, …) in the Vercel dashboard. `data/docs.db`
must exist at build time. Run `npm run ingest` as a build step or commit the
artifact.

---

## Contributing

- Type errors must stay clean: `npm run typecheck`.
- Add tests under `packages/*/test/` and run `npm test`.
- Breaking public-API changes need a migration in
  `packages/doks-core/migrations/<target-version>.js`. See
  [`packages/doks-core/migrations/README.md`](./packages/doks-core/migrations/README.md).

---

## License

MIT. See [LICENSE](./LICENSE).
