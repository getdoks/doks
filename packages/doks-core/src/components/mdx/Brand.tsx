import { defaultSiteConfig } from "../../lib/defaultConfig";

/**
 * Renders the site / brand name from siteConfig.
 * Use in MDX content so brand mentions are driven by config.
 *
 * @example
 *   Welcome to <SiteName />.
 */
export function SiteName() {
  return <>{defaultSiteConfig.siteName}</>;
}

/**
 * Renders the GitHub repo URL from siteConfig.
 * Use in MDX content to link back to the source repo.
 *
 * @example
 *   Source code at <GithubUrl />.
 */
export function GithubUrl() {
  return <>{defaultSiteConfig.githubUrl}</>;
}
