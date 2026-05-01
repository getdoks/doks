// Search route factory. Consumers call `createSearchHandler(store)` in
// their own `app/api/docs/search/route.ts` to wire the request handler
// to whichever `VectorStore` they configured. The framework no longer
// dictates the runtime: a SQLite consumer adds `runtime = 'nodejs'`,
// a D1 / edge consumer doesn't.

import { NextRequest, NextResponse } from 'next/server';
import { embedOne } from '../lib/embed';
import type { VectorStore } from '../types/VectorStore';

interface SearchRequest {
  query?: string;
  topK?: number;
}

export interface SearchHandler {
  POST: (req: NextRequest) => Promise<NextResponse>;
  GET: (req: NextRequest) => Promise<NextResponse>;
}

/**
 * A `VectorStore` directly, or a thunk that returns one (sync or async).
 * The thunk form is needed when the store can't be constructed at module
 * load — most notably on Cloudflare Workers, where the D1 binding only
 * becomes reachable per-request via `getCloudflareContext()`.
 */
export type VectorStoreInput =
  | VectorStore
  | (() => VectorStore | Promise<VectorStore>);

/**
 * Build a Next.js route handler bound to a `VectorStore`. Accepts either
 * a store directly or a function that returns one (sync or async). Use it
 * in `app/api/docs/search/route.ts`:
 *
 * ```ts
 * // Eager — store available at module load (SQLite, in-process).
 * import { createSearchHandler } from 'doks-core';
 * import { vectorStore } from '@/lib/doks.config';
 *
 * export const { POST, GET } = createSearchHandler(vectorStore);
 * ```
 *
 * ```ts
 * // Lazy — store needs per-request access to bindings (Cloudflare D1).
 * import { createSearchHandler } from 'doks-core';
 * import { createD1Store } from 'doks-core/adapters/d1';
 * import { getCloudflareContext } from '@opennextjs/cloudflare';
 *
 * export const { POST, GET } = createSearchHandler(
 *   () => createD1Store(getCloudflareContext().env.DB),
 * );
 * ```
 *
 * The lazy thunk is invoked once per request. Cache the result inside the
 * thunk if construction is expensive.
 */
export function createSearchHandler(store: VectorStoreInput): SearchHandler {
  const resolveStore: () => Promise<VectorStore> =
    typeof store === 'function'
      ? async () => await store()
      : async () => store;

  async function POST(req: NextRequest): Promise<NextResponse> {
    let body: SearchRequest;
    try {
      body = (await req.json()) as SearchRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const query = (body.query ?? '').trim();
    if (!query) {
      return NextResponse.json({ results: [] });
    }
    const topK = Math.min(Math.max(body.topK ?? 5, 1), 20);

    try {
      const queryEmbedding = await embedOne(query, 'query');
      const resolved = await resolveStore();
      const results = await resolved.search(queryEmbedding, topK);

      return NextResponse.json({
        query,
        results: results.map((r) => ({
          chunkId: r.chunkId,
          pageHref: r.pageHref,
          pageTitle: r.pageTitle,
          heading: r.heading,
          category: r.category,
          importance: r.importance,
          tags: r.tags,
          snippet:
            r.text.length > 320 ? r.text.slice(0, 320) + '…' : r.text,
          score: r.score,
          distance: r.distance,
        })),
      });
    } catch (err) {
      console.error('[/api/docs/search]', err);
      const message =
        err instanceof Error ? err.message : 'Search failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  async function GET(req: NextRequest): Promise<NextResponse> {
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const topK = Number(req.nextUrl.searchParams.get('topK') ?? '5');
    return POST(
      new NextRequest(req.url, {
        method: 'POST',
        body: JSON.stringify({ query: q, topK }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  return { POST, GET };
}
