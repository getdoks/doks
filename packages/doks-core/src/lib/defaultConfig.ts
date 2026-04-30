// packages/doks-core/src/lib/defaultConfig.ts
//
// Sensible default for the SiteConfig so consumers can render framework
// components (e.g. <Header />) standalone in tests without providing a
// config object.
//
// Import this instead of ../lib/site.config when you need a fallback
// that doesn't require a project-level config file.

import type { SiteConfig } from '../types/SiteConfig';

export const defaultSiteConfig: SiteConfig = {
  siteName: 'doks',
  logoText: 'doks',
  logoTag: 'Docs',
  description:
    'Open-source, RAG-optimized documentation framework on Next.js + MDX.',
  githubUrl: 'https://github.com/getdoks/doks',
  ctaLabel: 'Start free',
  ctaUrl: 'https://github.com/getdoks/doks',
  changelogUrl: undefined,
  chatLabel: 'Ask the docs',
  defaultTheme: 'light',
  showUpdatedBadge: true,
};

export default defaultSiteConfig;
