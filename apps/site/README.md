# {{your project}}

Documentation site built with [doks](https://github.com/getdoks/doks). A
Next.js + MDX docs framework with built-in RAG retrieval.

## Prerequisites

- Node.js ≥ 20
- npm

## Get started

```bash
npm install        # already done if you used `npx create-doks`
npm run ingest     # build the vector index at data/docs.db
npm run dev        # http://localhost:3000
```

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
| `.env.local` | API keys (Voyage, Anthropic, OpenAI, Gemini) |
| `app/globals.css` | Per-project CSS overrides on top of `doks-core/styles.css` |
| `next.config.mjs` | Next.js config. Usually no changes needed |

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

- **Cloudflare Workers**: switch `lib/doks.config.ts` to use
  `createD1Store(DB)`, provision D1 once with `npx wrangler d1 create`,
  commit a `wrangler.jsonc` with the binding, then deploy with
  `npm run deploy`. See the deployment guide for the full step-by-step.

## License

MIT.
