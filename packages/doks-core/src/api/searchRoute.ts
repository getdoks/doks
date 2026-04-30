import { NextRequest, NextResponse } from 'next/server';
import { embedOne } from '../lib/embed';
import { vectorSearch } from '../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchRequest {
  query?: string;
  topK?: number;
}

export async function POST(req: NextRequest) {
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
    const results = vectorSearch(queryEmbedding, topK);

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        chunkId: r.chunk_id,
        pageHref: r.page_href,
        pageTitle: r.page_title,
        heading: r.heading,
        category: r.category,
        importance: r.importance,
        tags: r.tags,
        snippet: r.text.length > 320 ? r.text.slice(0, 320) + '…' : r.text,
        score: r.score,
        distance: r.distance,
      })),
    });
  } catch (err) {
    console.error('[/api/docs/search]', err);
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
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
