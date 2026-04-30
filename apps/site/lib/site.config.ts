// apps/site/lib/site.config.ts
//
// User-owned brand configuration. Implements the SiteConfig interface
// from doks-core. Change these values to customize your documentation site.

import type { SiteConfig } from "doks-core";

export const siteConfig: SiteConfig = {
  siteName: "doks",
  logoText: "doks",
  logoSrc: "/logo.svg",
  logoSrcDark: "/logo-dark.svg",
  logoAlt: "doks",
  logoTag: "Documentation",
  description:
    "Open-source, RAG-optimized documentation framework on Next.js + MDX.",
  githubUrl: "https://github.com/getdoks/doks",
  ctaLabel: "Start free",
  ctaUrl: "https://github.com/getdoks/doks",
  changelogUrl: undefined,
  chatLabel: "Ask the docs",
  defaultTheme: "light",
  showUpdatedBadge: true,
};

export default siteConfig;
