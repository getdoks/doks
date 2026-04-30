# doks

**Open source · MIT · v0.1**

## Make your docs answer back.

An open-source, RAG-optimized docs framework on Next.js + MDX. Bring your own keys — Voyage, Anthropic, OpenAI, Gemini, Mistral, or a local model. No SaaS layer, no sign-up, no telemetry. Ship in an afternoon.

- [Get started](/docs/getting-started/quickstart)
- [View on GitHub](https://github.com/getdoks/doks)

---

## Why it's safe to try

- **BYO keys** — Voyage, Anthropic, OpenAI, Gemini, Mistral, Ollama. Your keys in your `.env`. → [`/docs/reference/search-api`](/docs/reference/search-api)
- **No SaaS layer** — One Next.js repo. No account to create, nothing to install on our side. → [`/docs/getting-started/project-structure`](/docs/getting-started/project-structure)
- **No telemetry** — No tracking, no email list, no analytics pings. Reads like a static site. → [`/docs/getting-started/quickstart`](/docs/getting-started/quickstart)
- **MIT licensed** — Take the repo, ship your docs, leave a footnote if you feel like it. → [github.com/getdoks/doks](https://github.com/getdoks/doks)

---

## Your keys, your bills

### Bring your own everything.

doks talks to two providers — one for embeddings, one for chat. Both are async functions you can swap by changing a URL and an API key. Costs go directly to the provider you choose; nothing routes through us, because there is no us.

> **What you'll need before you ship**
> An embedding key (Voyage AI is the reference, free tier is plenty for most docs sites — or run the deterministic hash fallback offline for local development) and a chat-completion key from any major provider (Anthropic, OpenAI, Gemini, Mistral) or a local runtime (Ollama, LM Studio). Both go in a `.env` file. Swap them any time.

---

## How it works

### Four stages. One repo.

Your MDX is the corpus. The build step is the indexer. A small API route is the retriever. A streamed call to your model is the synthesizer.

1. **Stage 01 · Chunk**
   Each `.mdx` file under `content/docs/` becomes a page. Inside, you wrap retrievable units in `<Chunk id="...">` tags. Frontmatter (`title`, `category`, `tags`, `vector_metadata.importance`) carries the metadata the retriever ranks on. Versioned with git.

2. **Stage 02 · Index**
   `npm run ingest` walks the tree, extracts chunks, calls Voyage AI with **your key** for embeddings, and writes them to a local SQLite database with the `sqlite-vec` extension. One file at `data/docs.db`. No vector DB to provision.

3. **Stage 03 · Retrieve**
   `/api/docs/search` takes a query, embeds it, runs a vec0 ANN scan + lexical filter, and returns the top-k chunks with their metadata. Spotlight (⌘K) calls the same endpoint.

4. **Stage 04 · Answer**
   The chat panel ("Ask the docs") packs retrieved chunks into a system prompt, appends history for follow-up turns, and streams the model's answer — through **your provider key** — back into the page. Citations link to the source chunk.

---

## Hosted RAG stack vs the doks way

### What you don't have to operate.

A full hosted retrieval stack is multiple services, a monthly bill, and an on-call rotation. doks is one repo that ships to your existing static host plus one tiny API route.

| Hosted RAG stack | The doks way |
|---|---|
| Managed vector database | `sqlite-vec` in a single file (`data/docs.db`) |
| Embedding pipeline (queue, worker, retry) | `npm run ingest` — runs at build, idempotent |
| Backend & query broker | One Next.js route handler (`/api/docs/search`) |
| Retrieval observability platform | The Network tab + the chunks you authored |
| Monthly bill | Whatever your static host already costs |
| On-call rotation | Nothing to operate |

---

## Inside the codebase

### Four pieces matter.

Reading the source is the documentation. Here are the four files that carry the pattern end-to-end.

### A · Corpus — your MDX

Every section becomes a chunk. The `<Chunk id>` is the rowid in the index; the heading and body become the embedded text.

```mdx
---
title: "Authentication"
category: "core-concepts"
tags: ["auth", "api-keys"]
vector_metadata:
  importance: 0.8
---

<Chunk id="auth-api-keys">
## API keys

Issue a key from the dashboard and pass it as
`Authorization: Bearer <key>` on every request.
</Chunk>
```

### B · Index — `scripts/ingest.ts`

One script, run at build time. Walks `content/docs/`, extracts chunks, embeds them with Voyage AI (or a deterministic hash fallback for offline runs), and writes them to `data/docs.db`.

```ts
// scripts/ingest.ts
const chunks = extractAllChunks();
const db = getDb();
resetTables(db);

for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE);
  const texts = batch.map(chunkText);
  const embeddings = await embed(texts, 'document');
  insertChunkBatch(db, batch, embeddings);
}
```

### C · Retrieve — `app/api/docs/search/route.ts`

A single route handler. Embeds the query, runs vec0 ANN against `chunks_vec`, joins back to chunk metadata, ranks, returns. Used by both Spotlight (⌘K) and the chat panel.

```ts
// app/api/docs/search/route.ts (sketch)
export async function POST(req: Request) {
  const { q, topK = 5 } = await req.json();
  const queryVec = await embedOne(q, 'query');
  const hits = searchSimilar(queryVec, topK);
  return Response.json({ hits });
}
```

### D · Answer — the chat panel

Multi-turn. Retrieved chunks become context. History is appended for follow-up turns. The model streams the answer; the panel renders tokens as they arrive. The only network round-trip is the model call.

```ts
async function send(question: string) {
  const { hits } = await fetch('/api/docs/search', {
    method: 'POST',
    body: JSON.stringify({ q: question, topK: 4 }),
  }).then((r) => r.json());

  const system = buildPrompt(hits);
  const stream = await callModel({ system, question, hist });
  for await (const tok of stream) render(tok);
}
```

---

## Provider-agnostic

### Bring your own embedder. Bring your own model.

doks ships with two adapters — one for embeddings (`lib/embed.ts`) and one for chat completions. Both are small async functions. Swap providers without touching the pattern.

- **Voyage AI** — Reference embedder. `voyage-3-lite` at 512d. Fallback hash when offline.
- **OpenAI** — `text-embedding-3-small` or chat completion. Same shape; swap the URL and auth.
- **Anthropic Claude** — Reference chat model. Streaming is clean and tool-use translates well.
- **Gemini** — Strong free-tier limits — good fit for OSS docs and side projects.
- **Mistral** — Fast and inexpensive. Mixtral for long-form, Mistral Small for quick Q&A.
- **Local models** — Ollama or LM Studio. Same adapter — just point it at localhost.

### The adapter

The whole integration surface is one async function: takes a system prompt, a question, and history; yields tokens.

```ts
// One adapter, swap providers by changing the URL + auth.
async function callModel({ system, question, hist }) {
  const res = await fetch(PROVIDER_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        { role: 'system', content: system },
        ...hist,
        { role: 'user', content: question },
      ],
    }),
  });
  return parseSSE(res.body);
}
```

---

## Get started

### Four steps. An afternoon.

Clone the repo. Write your MDX. Run ingest. Ship.

1. **Step 01 · Clone the repo**
   `git clone https://github.com/getdoks/doks` — one Next.js project. Components, ingest script, search route, chat panel all included.

2. **Step 02 · Write your docs in MDX**
   Add files to `content/docs/`. Wrap retrievable units in `<Chunk id="...">`. Set `category`, `tags`, and `vector_metadata.importance` in frontmatter. 50–500 chunks is the sweet spot.

3. **Step 03 · Run ingest**
   `VOYAGE_API_KEY=… npm run ingest` builds `data/docs.db` with embeddings + metadata. Re-run any time MDX changes; it's idempotent.

4. **Step 04 · Ship**
   `npm run build && npm start`. The chat panel calls your model directly through a tiny proxy that holds the key. Push to your existing static host plus a serverless runtime.

```bash
# 1. Clone the reference
git clone https://github.com/getdoks/doks
cd doks && npm install

# 2. Edit MDX under content/docs/
$EDITOR content/docs/index.mdx

# 3. Build the index
VOYAGE_API_KEY=… npm run ingest

# 4. Ship
npm run build && npm start
```

---

## What's in the box

### Built end-to-end.

Everything below is wired and shipping in v0.1.

- **MDX content** with frontmatter-driven nav, ordering, badges, and TOC
- **`<Chunk>` retrieval markers** — the unit your retriever returns
- **Voyage AI embeddings** with a deterministic hash fallback for offline runs
- **`sqlite-vec` index** stored as one file at `data/docs.db`
- **Semantic + lexical search** via `/api/docs/search`
- **⌘K Spotlight** that calls the search route
- **"Ask the docs" chat panel** — multi-turn, streamed, with chunk citations
- **Recursive sidebar nav** — folders nest, top-level docs sit beside groups
- **Right rail TOC** with live active-heading tracking
- **Mobile drawers** — left hamburger for nav, right hamburger for page menu
- **Theme toggle** — light, dark, blue-pearl, sand
- **MDX components** — Hero, HeroButton, QJump, QCard, Callout, Tabs, Steps, CodeBlock
- **Copy-page-as-Markdown** button for LLM-friendly sharing
- **Prev / next** neighbor links from the doc tree

---

## What it costs

### Almost nothing.

No vector database, no embedding service to operate, no query broker.

| Line item | Cost |
|---|---|
| Vector database | `$0.00` — `sqlite-vec` |
| Embedding pipeline | `$0.00` — runs in your build step |
| Backend & query broker | `$0.00` — one Next.js route |
| Static / serverless hosting | what you already pay |
| Embedding tokens (Voyage) | `≈ $0.02 / 1M tokens` |
| Per answered question | `≈ $0.002` (model-dependent) |
| **Fixed monthly** | **nothing** |

---

## About

### The pattern is the project.

> **What it is**
> doks is a public pattern, not a product. There is no company behind it, no tracking on this site, and no email list to join. It's released under MIT.

The reference is one Next.js repo: the MDX, the ingest script, the search route, and the chat panel all live in one place. Reading the source is the documentation.

The repository lives at `github.com/getdoks/doks`.

### Where it stands

- Reference Next.js + MDX site
- `<Chunk>` authoring + frontmatter pipeline
- `sqlite-vec` index + Voyage embeddings
- `/api/docs/search` semantic + lexical retrieval
- Multi-turn streamed chat panel against any provider
- Provider-agnostic adapter (Anthropic, OpenAI, Gemini, Mistral, Llama, local)
- Stripped-down starter template
- Hybrid BM25 + vector ranking
- First-class auto-generated chunks from prose

### The name

doks is the way "docs" gets typed when you're moving fast. Lowercased on purpose; capitalise it when it deserves a name. Either is fine.

### License

MIT. Take the file, ship your docs, leave a footnote if you feel like it. Contributions, issues, and forks all welcome at the repo.

---

## MIT · Open source

### Read the source. Fork it. Ship it.

doks is a public pattern, released under MIT. There is no company behind it, no email list to join, and nothing to install beyond a Next.js project. Take it and make your docs answer questions.
