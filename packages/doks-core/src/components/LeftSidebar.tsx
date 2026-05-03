'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { DocNode } from '../lib/docs';

function humanize(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface NavItemProps {
  href: string;
  title: string;
  badge?: { label: string; variant?: 'v' | 'new' };
  isActive: boolean;
  onNavigate?: () => void;
}

function NavItem({ href, title, badge, isActive, onNavigate }: NavItemProps) {
  return (
    <Link
      className={`ni${isActive ? ' on' : ''}`}
      href={href}
      onClick={onNavigate}
    >
      {title}
      {badge && (
        <span
          className={`nbadge ${badge.variant === 'new' ? 'nb-new' : 'nb-v'}`}
        >
          {badge.label}
        </span>
      )}
    </Link>
  );
}

interface NavGroupProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  nested?: boolean;
}

function NavGroup({ label, children, defaultOpen = true, nested = false }: NavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`ng${nested ? ' ng-sub' : ''}${open ? '' : ' shut'}`}>
      <div className="ng-hd" onClick={() => setOpen(!open)}>
        <span className="ng-lbl">{label}</span>
        <svg
          className="ng-arr"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 5l4 4 4-4" />
        </svg>
      </div>
      <div className="ni-wrap">{children}</div>
    </div>
  );
}

interface LeftSidebarProps {
  tree: DocNode[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function renderNode(
  node: DocNode,
  pathname: string,
  onCloseMobile: () => void,
  nested: boolean,
): React.ReactNode {
  if (node.type === 'doc') {
    const fm = node.meta?.frontmatter;
    return (
      <NavItem
        key={node.href ?? node.name}
        href={node.href ?? '#'}
        title={fm?.title ?? humanize(node.name)}
        badge={fm?.badge}
        isActive={pathname === node.href}
        onNavigate={onCloseMobile}
      />
    );
  }
  return (
    <NavGroup
      key={node.name}
      label={node.label ?? humanize(node.name)}
      nested={nested}
    >
      {node.children.map((child) =>
        renderNode(child, pathname, onCloseMobile, true),
      )}
    </NavGroup>
  );
}

export default function LeftSidebar({
  tree,
  mobileOpen,
  onCloseMobile,
}: LeftSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-wrap">
        <nav className="sidebar-nav">
          {tree.map((node) => {
            if (node.type === 'doc') {
              return (
                <div className="ni-wrap" key={node.name} style={{ paddingTop: 8 }}>
                  <NavItem
                    href={node.href ?? '#'}
                    title={node.meta?.frontmatter.title ?? humanize(node.name)}
                    isActive={pathname === node.href}
                    onNavigate={onCloseMobile}
                  />
                </div>
              );
            }
            return renderNode(node, pathname, onCloseMobile, false);
          })}
        </nav>
        <div className="sidebar-version">
          <a
            className="sv-info"
            href="https://github.com/getdoks/doks"
            target="_blank"
            rel="noreferrer noopener"
          >
            Powered by <strong>doks</strong>.
          </a>
        </div>
      </div>
    </aside>
  );
}
