'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export interface SemanticSearchResult {
  chunkId: string;
  pageHref: string;
  pageTitle: string;
  heading: string;
  category: string | null;
  importance: number;
  tags: string[];
  snippet: string;
  score: number;
  distance: number;
}

interface SemanticSearchProps {
  placeholder?: string;
  topK?: number;
  // When true, results render below the input. When false, the parent
  // controls the result list via the onResults callback.
  inlineResults?: boolean;
  onResults?: (results: SemanticSearchResult[], query: string) => void;
  className?: string;
}

export default function SemanticSearch({
  placeholder = 'Ask the docs anything…',
  topK = 5,
  inlineResults = true,
  onResults,
  className,
}: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      onResults?.([], '');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/docs/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, topK }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { results: SemanticSearchResult[] };
        setResults(data.results);
        onResults?.(data.results, q);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError((e as Error).message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, topK, onResults]);

  return (
    <div className={`semsearch${className ? ' ' + className : ''}`}>
      <div className="semsearch-input-row">
        <svg
          className="semsearch-icon"
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3 3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className="semsearch-spinner" />}
      </div>

      {inlineResults && (
        <div className="semsearch-results">
          {error && <p className="semsearch-error">{error}</p>}
          {!error && query.trim() && !loading && results.length === 0 && (
            <p className="semsearch-empty">No matches.</p>
          )}
          {results.map((r) => (
            <Link
              key={r.chunkId}
              href={`${r.pageHref}#${r.chunkId.split(':').pop()}`}
              className="semsearch-result"
            >
              <div className="semsearch-result-meta">
                {r.category && <span className="semsearch-cat">{r.category}</span>}
                <span className="semsearch-score">
                  {(r.score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="semsearch-result-title">{r.heading}</div>
              <div className="semsearch-result-page">{r.pageTitle}</div>
              <p className="semsearch-result-snippet">{r.snippet}</p>
              {r.tags.length > 0 && (
                <div className="semsearch-tags">
                  {r.tags.slice(0, 4).map((t) => (
                    <span key={t} className="semsearch-tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .semsearch {
          width: 100%;
          font-family: inherit;
        }
        .semsearch-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          background: var(--card, #fff);
        }
        .semsearch-input-row:focus-within {
          border-color: var(--accent, #6366f1);
          box-shadow: 0 0 0 3px var(--accent-tint, rgba(99, 102, 241, 0.12));
        }
        .semsearch-icon {
          color: var(--muted, #6b7280);
          flex-shrink: 0;
        }
        .semsearch-input-row input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 14px;
          color: inherit;
        }
        .semsearch-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid var(--border, #e5e7eb);
          border-top-color: var(--accent, #6366f1);
          border-radius: 50%;
          animation: ss-spin 0.8s linear infinite;
        }
        @keyframes ss-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .semsearch-results {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .semsearch-result {
          display: block;
          padding: 12px 14px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          background: var(--card, #fff);
          text-decoration: none;
          color: inherit;
          transition: border-color 0.12s ease, transform 0.12s ease;
        }
        .semsearch-result:hover {
          border-color: var(--accent, #6366f1);
          transform: translateY(-1px);
        }
        .semsearch-result-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted, #6b7280);
          margin-bottom: 4px;
        }
        .semsearch-cat {
          font-weight: 600;
        }
        .semsearch-score {
          color: var(--accent, #6366f1);
          font-variant-numeric: tabular-nums;
        }
        .semsearch-result-title {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 2px;
        }
        .semsearch-result-page {
          font-size: 12px;
          color: var(--muted, #6b7280);
          margin-bottom: 6px;
        }
        .semsearch-result-snippet {
          font-size: 13px;
          line-height: 1.5;
          color: var(--subtle, #4b5563);
          margin: 0;
        }
        .semsearch-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
        }
        .semsearch-tag {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 999px;
          background: var(--chunk-bg, #f3f4f6);
          color: var(--subtle, #4b5563);
        }
        .semsearch-empty,
        .semsearch-error {
          font-size: 13px;
          color: var(--muted, #6b7280);
          padding: 8px 4px;
          margin: 0;
        }
        .semsearch-error {
          color: #b91c1c;
        }
      `}</style>
    </div>
  );
}
