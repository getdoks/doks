# {{your project}}

Documentation site built with [doks](https://github.com/getdoks/doks). A
Next.js + MDX docs framework with built-in RAG retrieval.

## Prerequisites

- Node.js ≥ 20
- npm

## Get started

```bash
npm install        # already done if you used `npx create-doks`
npm run dev        # http://localhost:3000
```

The `predev` script runs `doks build:content && doks ensure-index`, which:

1. Snapshots `content/docs/` into `lib/doks-content.gen.ts` (gitignored)
   so doc pages render at request time without filesystem reads. This is
   what lets the same code deploy to Vercel/Node and Cloudflare Workers.
2. Builds `data/docs.db` if it's missing (SQLite vector index for search;
   skipped silently for D1 setups).

After editing MDX, both run again on the next `npm run dev`. For an
explicit re-ingest use `npm run ingest`.

## Authoring

Add `.mdx` files under `content/docs/`. The file path becomes the URL
(`content/docs/foo/bar.mdx` → `/docs/foo/bar`). Each file needs frontmatter:

```mdx
---
title: "Authentication"
category: "core-concepts"
tags: ["auth"]
order: 2
vector_metadata:
  importance: 0.8
---

<Chunk id="api-keys" importance={0.9}>
## API keys

Issue a key from the dashboard and pass it as
`Authorization: Bearer <key>` on every request.
</Chunk>
```

Re-run `npm run ingest` after editing MDX so the search index picks up changes.

See the [authoring guide](./content/docs/guides/writing-rag-friendly-mdx.mdx)
for chunk sizing and ranking tips.

## Configuration

| File | What it controls |
| --- | --- |
| `lib/site.config.ts` | Brand strings: site name, logo, GitHub URL, default theme |
| `lib/doks.config.ts` | Vector-store adapter (SQLite default; swap for D1 on Cloudflare) |
| `.env.local` | API keys (Voyage, Anthropic, OpenAI, Gemini) |
| `app/globals.css` | Per-project CSS overrides on top of `doks-core/styles.css` |
| `next.config.mjs` | Next.js config. Usually no changes needed (uncomment the OpenNext dev hook for D1) |
| `open-next.config.ts` | Cloudflare-only. Re-exports the doks-core OpenNext config (R2 incremental cache) |

Environment variables are documented in `.env.example`. All are optional for
local dev (the framework falls back to a deterministic hash embedder when
`VOYAGE_API_KEY` is unset).

## Upgrading the framework

```bash
npx doks upgrade           # bumps doks-core, runs any pending migrations
npx doks upgrade --dry-run # preview what would run
```

## Deployment

The default SQLite adapter needs a Node runtime (Vercel, Netlify,
Railway, Render, Docker). Cloudflare Workers needs the D1 adapter
instead. Both flows are covered in detail in the
[Deployment guide](https://github.com/getdoks/doks/blob/main/apps/site/content/docs/guides/deployment.mdx).

Quick paths:

- **Vercel** (most projects):

  ```bash
  npx vercel --prod
  ```

  Set `VOYAGE_API_KEY` and (optionally) `ANTHROPIC_API_KEY` in the dashboard.
  `data/docs.db` must exist at build time, so add `npm run ingest` to your
  build command, or commit the artifact.

- **Cloudflare Workers** (one shot):

  ```bash
  npx wrangler login
  npx doks deploy:cloudflare    # peers + D1 + R2 + configs + token prompt
  DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest
  npm run deploy
  ```

  Add `--dry-run` to preview. If you scaffolded with `--target cloudflare`
  the configs are already wired and only the cloud provisioning runs. See
  the deployment guide for the manual path and what each step does.

## License

MIT.
