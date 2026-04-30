'use client';

import type { DocNode } from '../lib/docs';
import type { SiteConfig } from '../types/SiteConfig';
import Header from './Header';
import LeftSidebar from './LeftSidebar';
import Spotlight, { type SpotlightDoc } from './Spotlight';
import { UIStateProvider, useUIState } from './UIStateContext';

interface DocsShellProps {
  tree: DocNode[];
  spotlightDocs: SpotlightDoc[];
  siteConfig: SiteConfig;
  updatedDate?: string;
  children: React.ReactNode;
}

function ShellInner({
  tree,
  spotlightDocs,
  siteConfig,
  updatedDate,
  children,
}: DocsShellProps) {
  const {
    chatOpen,
    mobileNavOpen,
    mobilePageMenuOpen,
    spotlightOpen,
    toggleChat,
    toggleMobileNav,
    closeMobileNav,
    toggleMobilePageMenu,
    closeMobilePageMenu,
    openSpotlight,
    closeSpotlight,
  } = useUIState();

  const anyDrawerOpen = mobileNavOpen || mobilePageMenuOpen;
  const closeAnyDrawer = () => {
    closeMobileNav();
    closeMobilePageMenu();
  };

  return (
    <>
      <Header
        siteConfig={siteConfig}
        chatOpen={chatOpen}
        onOpenSpotlight={openSpotlight}
        onToggleChat={toggleChat}
        onToggleMobileNav={toggleMobileNav}
        onToggleMobilePageMenu={toggleMobilePageMenu}
        updatedDate={updatedDate}
      />
      <div
        className={`nav-backdrop${anyDrawerOpen ? ' show' : ''}`}
        onClick={closeAnyDrawer}
      />
      <div className={`page${mobilePageMenuOpen ? ' page-menu-open' : ''}`}>
        <LeftSidebar tree={tree} mobileOpen={mobileNavOpen} onCloseMobile={closeMobileNav} />
        {children}
      </div>
      <Spotlight docs={spotlightDocs} open={spotlightOpen} onClose={closeSpotlight} />
    </>
  );
}

export default function DocsShell(props: DocsShellProps) {
  return (
    <UIStateProvider>
      <ShellInner {...props} />
    </UIStateProvider>
  );
}
