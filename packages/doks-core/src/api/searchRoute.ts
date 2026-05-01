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
 * Build a Next.js route handler bound to a specific `VectorStore`. Use it
 * in `app/api/docs/search/route.ts`:
 *
 * ```ts
 * import { createSearchHandler } from 'doks-core';
 * import { vectorStore } from '@/lib/doks.config';
 *
 * export const { POST, GET } = createSearchHandler(vectorStore);
 * // Optional: declare the runtime your store needs.
 * // export const runtime = 'nodejs';      // SQLite
 * // export const runtime = 'edge';        // D1
 * ```
 */
export function createSearchHandler(store: VectorStore): SearchHandler {
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
      const results = await store.search(queryEmbedding, topK);

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
