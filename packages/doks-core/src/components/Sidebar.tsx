import Link from 'next/link';
import type { DocNode } from '../lib/docs';

function humanize(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function NodeView({ node, depth }: { node: DocNode; depth: number }) {
  if (node.type === 'doc') {
    const title = node.meta?.frontmatter.title ?? humanize(node.name);
    return (
      <li>
        <Link
          href={node.href ?? '#'}
          className="block py-1 px-2 rounded text-sm hover:bg-[var(--chunk-bg)] hover:text-[var(--accent)] transition-colors"
        >
          {title}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <div
        className="py-1 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]"
        style={{ paddingLeft: `${depth * 0.5}rem` }}
      >
        {humanize(node.name)}
      </div>
      <ul className="ml-2 border-l border-[var(--border)] pl-2">
        {node.children.map((child) => (
          <NodeView key={child.name} node={child} depth={depth + 1} />
        ))}
      </ul>
    </li>
  );
}

export default function Sidebar({ tree }: { tree: DocNode[] }) {
  return (
    <nav className="text-sm">
      <Link
        href="/"
        className="block mb-4 text-lg font-bold tracking-tight"
      >
        doks
      </Link>
      <ul className="space-y-1">
        {tree.map((node) => (
          <NodeView key={node.name} node={node} depth={0} />
        ))}
      </ul>
    </nav>
  );
}
