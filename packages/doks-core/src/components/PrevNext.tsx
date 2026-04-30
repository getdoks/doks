import Link from 'next/link';
import type { DocMeta } from '../lib/docs';

interface PrevNextProps {
  prev: DocMeta | null;
  next: DocMeta | null;
}

export default function PrevNext({ prev, next }: PrevNextProps) {
  if (!prev && !next) return null;
  return (
    <div className="pn">
      {prev ? (
        <Link className="pnb" href={prev.href}>
          <span className="pnd">← Previous</span>
          <span className="pnt">{prev.frontmatter.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="pnb r" href={next.href}>
          <span className="pnd">Next →</span>
          <span className="pnt">{next.frontmatter.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
