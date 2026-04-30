'use client';

import type { TocItem } from '../lib/docs';
import RightRail from './RightRail';
import { useUIState } from './UIStateContext';

export default function DocPageRail({ toc }: { toc: TocItem[] }) {
  const { chatOpen, toggleChat, mobilePageMenuOpen, closeMobilePageMenu } = useUIState();
  return (
    <RightRail
      toc={toc}
      chatOpen={chatOpen}
      onToggleChat={toggleChat}
      mobileOpen={mobilePageMenuOpen}
      onCloseMobile={closeMobilePageMenu}
    />
  );
}
