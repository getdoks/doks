import type { Metadata } from "next";
import "./globals.css";

import { siteConfig } from "@/lib/site.config";
import { buildDocTree, getAllDocs, DocsShell } from "doks-core";
import type { SpotlightDoc } from "doks-core";

export const metadata: Metadata = {
  title: {
    default: siteConfig.siteName,
    template: `%s. ${siteConfig.siteName}`,
  },
  description: siteConfig.description,
  icons: {
    // Adaptive favicon. The SVG itself contains a `prefers-color-scheme`
    // media query, so the same file fills dark vs light tabs correctly.
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

const themeInit = `
(function () {
  try {
    var saved = localStorage.getItem('dd-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));
  } catch (e) {}
})();
`;

function humanizeSlug(slug: string[]): string {
  return slug
    .map((s) =>
      s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(" / ");
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = buildDocTree();
  const spotlightDocs: SpotlightDoc[] = getAllDocs().map((d) => ({
    href: d.href,
    title: d.frontmatter.title,
    section: d.frontmatter.category
      ? d.frontmatter.category
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : humanizeSlug(d.slug.slice(0, -1)) || "Overview",
    description: d.frontmatter.description ?? "",
  }));

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <div id="bar" />
        <DocsShell
          tree={tree}
          spotlightDocs={spotlightDocs}
          siteConfig={siteConfig}
          updatedDate="Apr 27, 2026"
        >
          {children}
        </DocsShell>
      </body>
    </html>
  );
}
