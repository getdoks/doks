"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SiteConfig } from "../types/SiteConfig";
import { getTheme, setTheme as applyTheme } from "../lib/theme";
import { defaultSiteConfig } from "../lib/defaultConfig";

interface HeaderProps {
  siteConfig?: SiteConfig;
  onOpenSpotlight: () => void;
  onToggleChat: () => void;
  onToggleMobileNav: () => void;
  onToggleMobilePageMenu: () => void;
  chatOpen: boolean;
  updatedDate?: string;
}

export default function Header({
  siteConfig: siteConfigProp,
  onOpenSpotlight,
  onToggleChat,
  onToggleMobileNav,
  onToggleMobilePageMenu,
  chatOpen,
  updatedDate,
}: HeaderProps) {
  const siteConfig = siteConfigProp ?? defaultSiteConfig;
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <header className="hdr">
      <button
        className="hdr-burger"
        onClick={onToggleMobileNav}
        aria-label="Toggle navigation"
        title="Menu"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M3 5h12M3 9h12M3 13h12" />
        </svg>
      </button>
      <Link className="hdr-logo" href="/">
        {siteConfig.logoSrc ? (
          <>
            <img
              className="logo-img logo-img-light"
              src={siteConfig.logoSrc}
              alt={siteConfig.logoAlt ?? siteConfig.siteName}
            />
            <img
              className="logo-img logo-img-dark"
              src={siteConfig.logoSrcDark ?? siteConfig.logoSrc}
              alt={siteConfig.logoAlt ?? siteConfig.siteName}
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            <div className="logo-mark">D</div>
            <span className="logo-name">{siteConfig.logoText}</span>
          </>
        )}
        {siteConfig.logoTag && (
          <span className="logo-tag">{siteConfig.logoTag}</span>
        )}
      </Link>
      <div className="hdr-center">
        <button
          className="search-btn"
          onClick={onOpenSpotlight}
          aria-label="Search documentation"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5l2.5 2.5" />
          </svg>
          <span className="search-btn-label">Search documentation…</span>
          <span className="kbd-hint">⌘K</span>
        </button>
      </div>
      <div className="hdr-right">
        {siteConfig.showUpdatedBadge && updatedDate && (
          <span className="hdr-updated" title="Last updated">
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="7" cy="7" r="5.5" />
              <path d="M7 4v3l2 1.5" />
            </svg>
            Updated {updatedDate}
          </span>
        )}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
        >
          {/* Inline SVGs (instead of <img src>) so `currentColor` resolves
              against the button's own `color`, which is a theme-aware
              token (var(--muted), brand on hover). Without inlining, the
              icons render black in dark mode against a dark background. */}
          <svg
            className="icon-moon"
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 -960 960 960"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 198t198 82Zm-10-270Z" />
          </svg>
          <svg
            className="icon-sun"
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 -960 960 960"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M565-395q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Zm-226.5 56.5Q280-397 280-480t58.5-141.5Q397-680 480-680t141.5 58.5Q680-563 680-480t-58.5 141.5Q563-280 480-280t-141.5-58.5ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 96 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-98-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55 53-97 101-59-57Zm326-268Z" />
          </svg>
        </button>
        <a
          className="hdr-link"
          href={siteConfig.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          title="GitHub"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        {siteConfig.changelogUrl && (
          <a className="hdr-link" href={siteConfig.changelogUrl}>
            Changelog
          </a>
        )}
        <button
          className={`chat-toggle-btn${chatOpen ? " on" : ""}`}
          onClick={onToggleChat}
          aria-label="Toggle chat"
        >
          <span className="ctb-dot" />
          <span className="ctb-label">{siteConfig.chatLabel}</span>
        </button>
        {siteConfig.ctaLabel && (
          <button
            className="hdr-cta"
            onClick={() => window.open(siteConfig.ctaUrl)}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 1l1.5 4 4 1.5-4 1.5L7 12 5.5 8 1.5 6.5 5.5 5 7 1z" />
            </svg>
            <span className="hdr-cta-label">{siteConfig.ctaLabel}</span>
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h6M6 3l3 3-3 3" />
            </svg>
          </button>
        )}
        <button
          className="hdr-burger hdr-burger-r"
          onClick={onToggleMobilePageMenu}
          aria-label="Toggle page menu"
          title="Page menu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M4 5h10M7 9h7M4 13h10" />
          </svg>
        </button>
      </div>
    </header>
  );
}
