'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface SpotlightDoc {
  href: string;
  title: string;
  section: string;
  description: string;
}

// ── Fuzzy matching ───────────────────────────────────────────────────
// Score a haystack against a needle. Higher is better; 0 means no match.
// Handles exact matches, substrings, word-prefixes, subsequences, and
// short-edit-distance typos (transpositions like "mneu"↔"menu" or
// insertions like "meunu"↔"menu" via Damerau-Levenshtein).
function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[m][n];
}

function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();

  if (h === n) return 1000;
  if (h.startsWith(n)) return 800;

  const idx = h.indexOf(n);
  if (idx >= 0) return 600 - Math.min(idx, 100);

  // Word-level checks (split on whitespace, hyphens, underscores, slashes).
  const words = h.split(/[\s\-_/]+/).filter(Boolean);
  let bestWord = 0;
  for (const w of words) {
    if (w === n) bestWord = Math.max(bestWord, 700);
    else if (w.startsWith(n)) bestWord = Math.max(bestWord, 500);
    else if (w.includes(n)) bestWord = Math.max(bestWord, 400);
    else if (n.length >= 3) {
      const d = damerauLevenshtein(n, w);
      const allowed = n.length >= 4 ? 2 : 1;
      if (d <= allowed) bestWord = Math.max(bestWord, 350 - d * 60);
    }
  }
  if (bestWord > 0) return bestWord;

  // Subsequence match. Every char of n appears in h in order ("mnu" → "menu").
  let i = 0;
  for (const c of h) {
    if (c === n[i]) i++;
    if (i === n.length) return 220;
  }

  // Fallback whole-string edit distance for slightly mistyped multi-word
  // queries. Threshold scales with query length so longer typos are still
  // caught without flooding short queries with noise.
  if (n.length >= 4) {
    const d = damerauLevenshtein(n, h.slice(0, n.length + 4));
    if (d <= Math.max(2, Math.ceil(n.length / 4))) return 120;
  }
  return 0;
}

function scoreDoc(d: SpotlightDoc, q: string): number {
  // Title is the strongest signal, then section, then description.
  return Math.max(
    fuzzyScore(d.title, q) * 1.5,
    fuzzyScore(d.section, q) * 1.0,
    fuzzyScore(d.description, q) * 0.6,
  );
}

interface SpotlightProps {
  docs: SpotlightDoc[];
  open: boolean;
  onClose: () => void;
}

export default function Spotlight({ docs, open, onClose }: SpotlightProps) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery('');
      setHighlighted(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return docs.slice(0, 7);
    return docs
      .map((d) => ({ doc: d, score: scoreDoc(d, q) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((s) => s.doc);
  }, [docs, query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      const target = filtered[highlighted];
      if (target) {
        window.location.href = target.href;
        onClose();
      }
    }
  }

  return (
    <div
      className={`overlay${open ? ' show' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="spot">
        <div className="spot-row">
          <svg
            width="17"
            height="17"
            viewBox="0 0 17 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="7" cy="7" r="5.5" />
            <path d="M12 12l3 3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            id="sinp"
            placeholder="Search docs, sections, chunks…"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
          />
          <span className="spot-esc" onClick={onClose}>
            Esc
          </span>
        </div>
        <div id="slist">
          {filtered.length === 0 ? (
            <p className="sempty">No results found</p>
          ) : (
            filtered.map((d, i) => (
              <Link
                key={d.href}
                href={d.href}
                onClick={onClose}
                className={`sitem${i === highlighted ? ' hl' : ''}`}
              >
                <div className="sico">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 1.5h6l3 3V14a.5.5 0 01-.5.5h-8.5A.5.5 0 013.5 14V2a.5.5 0 01.5-.5z" />
                    <path d="M10 1.5v3h3" />
                  </svg>
                </div>
                <div className="sbody">
                  <div className="ssec">{d.section}</div>
                  <div className="stitle">{d.title}</div>
                  <div className="sexc">{d.description}</div>
                </div>
              </Link>
            ))
          )}
        </div>
        <div className="spot-foot">
          <span className="sh">
            <kbd>↑↓</kbd>Navigate
          </span>
          <span className="sh">
            <kbd>↵</kbd>Open
          </span>
          <span className="sh">
            <kbd>Esc</kbd>Close
          </span>
        </div>
      </div>
    </div>
  );
}
