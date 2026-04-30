'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface ChatScope {
  title: string;
  href: string;
  section?: string;
  description?: string;
}

interface UIState {
  chatOpen: boolean;
  mobileNavOpen: boolean;
  mobilePageMenuOpen: boolean;
  spotlightOpen: boolean;
  chatScope: ChatScope | null;
  pendingChatQuery: string | null;
  /** Right-rail "Page menu" desktop collapsed state. Persisted to
   *  localStorage so it survives both navigation and reloads. */
  pageMenuCollapsed: boolean;
  toggleChat: () => void;
  toggleMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobilePageMenu: () => void;
  closeMobilePageMenu: () => void;
  togglePageMenuCollapsed: () => void;
  openSpotlight: () => void;
  closeSpotlight: () => void;
  openChatWithScope: (scope: ChatScope, query?: string) => void;
  clearChatScope: () => void;
  consumePendingChatQuery: () => void;
}

const PAGE_MENU_COLLAPSED_KEY = 'dd-page-menu-collapsed';

const Ctx = createContext<UIState | null>(null);

export function UIStateProvider({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobilePageMenuOpen, setMobilePageMenuOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [chatScope, setChatScope] = useState<ChatScope | null>(null);
  const [pendingChatQuery, setPendingChatQuery] = useState<string | null>(null);
  const [pageMenuCollapsed, setPageMenuCollapsed] = useState(false);

  // Hydrate the persisted right-rail collapsed state on first mount.
  // Kept out of useState's initialiser to avoid SSR/CSR hydration drift:
  // the server always renders `false`, then the client flips it to the
  // saved value on the first effect tick.
  useEffect(() => {
    try {
      if (localStorage.getItem(PAGE_MENU_COLLAPSED_KEY) === '1') {
        setPageMenuCollapsed(true);
      }
    } catch {
      // localStorage may be unavailable (private mode, sandboxed iframe, …)
    }
  }, []);

  const togglePageMenuCollapsed = useCallback(() => {
    setPageMenuCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(PAGE_MENU_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleChat = useCallback(() => setChatOpen((o) => !o), []);
  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((o) => !o);
    setMobilePageMenuOpen(false);
  }, []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobilePageMenu = useCallback(() => {
    setMobilePageMenuOpen((o) => !o);
    setMobileNavOpen(false);
  }, []);
  const closeMobilePageMenu = useCallback(() => setMobilePageMenuOpen(false), []);
  const openSpotlight = useCallback(() => setSpotlightOpen(true), []);
  const closeSpotlight = useCallback(() => setSpotlightOpen(false), []);

  const openChatWithScope = useCallback(
    (scope: ChatScope, query?: string) => {
      setChatScope(scope);
      setPendingChatQuery(query?.trim() ? query.trim() : null);
      setChatOpen(true);
      setSpotlightOpen(false);
    },
    [],
  );
  const clearChatScope = useCallback(() => setChatScope(null), []);
  const consumePendingChatQuery = useCallback(() => setPendingChatQuery(null), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlightOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setChatOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setSpotlightOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Ctx.Provider
      value={{
        chatOpen,
        mobileNavOpen,
        mobilePageMenuOpen,
        spotlightOpen,
        chatScope,
        pendingChatQuery,
        pageMenuCollapsed,
        toggleChat,
        toggleMobileNav,
        closeMobileNav,
        toggleMobilePageMenu,
        closeMobilePageMenu,
        togglePageMenuCollapsed,
        openSpotlight,
        closeSpotlight,
        openChatWithScope,
        clearChatScope,
        consumePendingChatQuery,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUIState(): UIState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUIState must be used inside UIStateProvider');
  return ctx;
}
