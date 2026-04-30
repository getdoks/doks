import type { TocItem } from '../lib/docs';

export default function TocSidebar({ toc }: { toc: TocItem[] }) {
  if (!toc.length) return null;
  const showDebug = process.env.NODE_ENV !== 'production';

  return (
    <aside className="text-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
        On this page
      </div>
      <ul className="space-y-1">
        {toc.map((item, i) => (
          <li
            key={`${item.id}-${i}`}
            style={{ paddingLeft: `${(item.depth - 2) * 0.75}rem` }}
          >
            <a
              href={`#${item.id}`}
              className="flex items-baseline gap-2 py-0.5 hover:text-[var(--accent)] transition-colors"
            >
              <span className="truncate">{item.text}</span>
              {item.isChunk && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--chunk-bg)] border border-[var(--chunk-border)] text-[var(--muted)]"
                  title="RAG chunk"
                >
                  chunk
                </span>
              )}
            </a>
            {showDebug && item.isChunk && item.chunkId && (
              <div className="ml-2 text-[10px] font-mono text-[var(--muted)]">
                id: {item.chunkId}
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
