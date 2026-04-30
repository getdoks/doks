'use client';

import { useEffect, useRef, useState } from 'react';
import type { TocItem } from '../lib/docs';
import ChatPanel from './ChatPanel';
import { useUIState } from './UIStateContext';

interface RightRailProps {
  toc: TocItem[];
  chatOpen: boolean;
  onToggleChat: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function RightRail({
  toc,
  chatOpen,
  onToggleChat,
  mobileOpen = false,
  onCloseMobile,
}: RightRailProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { pageMenuCollapsed: collapsed, togglePageMenuCollapsed } = useUIState();
  const tocRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toc.length) return;
    const ids = toc.map((t) => t.id);

    // Header offset: where we consider a heading "active" once its top
    // crosses this y-position. Matches the sticky header height (~72px).
    const OFFSET = 80;

    let raf = 0;
    function update() {
      raf = 0;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - OFFSET;
        if (top <= 0) current = id;
        else break;
      }

      // Bottom-of-page guard: when the viewport reaches the document
      // bottom, IntersectionObserver-style strips can leave the last
      // section unmatched. Force the final heading active in that case.
      const scrollEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (scrollEnd) current = ids[ids.length - 1];

      // Above the first heading, default to the first item.
      if (!current) current = ids[0];

      setActiveId((prev) => (prev === current ? prev : current));
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [toc]);

  return (
    <>
      <button
        className={`cs-bookmark${collapsed ? ' cs-bookmark-collapsed' : ''}`}
        onClick={togglePageMenuCollapsed}
        aria-label={collapsed ? 'Show panel' : 'Hide panel'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Show panel' : 'Hide panel'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 3l-4 4 4 4" />
        </svg>
      </button>
      <aside
        className={`chat-sidebar${chatOpen ? ' chat-open' : ''}${collapsed ? ' cs-collapsed' : ''}${mobileOpen ? ' cs-mobile-open' : ''}`}
      >
        <div className="cs-tabs">
          <button
            className={`cs-tab${chatOpen ? '' : ' on'}`}
            onClick={() => {
              if (chatOpen) onToggleChat();
            }}
          >
            Page menu
          </button>
          <span className="cs-tab-sep" />
          <button
            className={`cs-tab${chatOpen ? ' on' : ''}`}
            onClick={() => {
              if (!chatOpen) onToggleChat();
            }}
          >
            Ask the docs
          </button>
        </div>

        <div className="cs-toc" ref={tocRef}>
          <div className="cs-toc-label">
            <span>On this page</span>
          </div>
          {toc.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--subtle)', padding: '0 4px' }}>
              No headings on this page.
            </div>
          ) : (
            <ul className="cs-toc-list" id="cs-toc-list">
              {toc.map((item, i) => {
                const depth = Math.min(Math.max(item.depth, 2), 4);
                return (
                  <li key={`${item.id}-${i}`}>
                    <a
                      href={`#${item.id}`}
                      onClick={onCloseMobile}
                      className={`cs-toc-link cs-toc-d${depth}${
                        item.isChunk ? ' cs-toc-chunk' : ''
                      }${activeId === item.id ? ' active' : ''}`}
                    >
                      {item.text}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="cs-chat">
          <ChatPanel />
        </div>
      </aside>
    </>
  );
}
