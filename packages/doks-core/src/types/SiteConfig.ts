// packages/doks-core/src/types/SiteConfig.ts
//
// Public interface for the project-level site config. Consumers (the
// `apps/site/` scaffold or any project using doks-core) must provide
// a value that implements this interface.

export interface SiteConfig {
  /** Site / brand name, used in <title> and the logo */
  siteName: string;
  /** Text shown next to the logo mark. Used as a fallback when no `logoSrc` is provided. */
  logoText: string;
  /** Optional URL or path to a logo image (e.g. `/logo.svg`). When set, replaces the lettermark + logoText with an `<img>`. */
  logoSrc?: string;
  /** Optional dark-theme variant of the logo. Used automatically when `<html data-theme="dark">`. Falls back to `logoSrc` if unset. */
  logoSrcDark?: string;
  /** Alt text for the logo image. Defaults to `siteName` when omitted. */
  logoAlt?: string;
  /** Optional pill label beside the logo (e.g. "Docs"). Set to undefined to hide. */
  logoTag?: string;
  /** <meta name="description"> content */
  description: string;
  /** GitHub repo URL. Header icon link, landing-page "View on GitHub" */
  githubUrl: string;
  /** "Start free" / primary CTA label. Set to undefined to hide the CTA button. */
  ctaLabel?: string;
  /** CTA button href */
  ctaUrl?: string;
  /** "Changelog" header link. Set to undefined to hide the link. */
  changelogUrl?: string;
  /** Label for the chat toggle ("Ask the docs") */
  chatLabel: string;
  /** Default theme applied before JS runs (applied via data-theme attribute) */
  defaultTheme: 'light' | 'dark' | 'blue-pearl' | 'sand';
  /** Whether to show the "Updated …" badge in the header */
  showUpdatedBadge: boolean;
}
