import Link from 'next/link';
import type { ReactNode } from 'react';

export function QJump({ children }: { children: ReactNode }) {
  return <div className="qjump">{children}</div>;
}

interface QCardProps {
  href: string;
  title: string;
  description: string;
  icon?: ReactNode;
}

export function QCard({ href, title, description, icon }: QCardProps) {
  return (
    <Link className="qcard" href={href}>
      <div className="qcard-ico">
        {icon ?? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9h12M9 3v12" />
          </svg>
        )}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="qcard-arr">→</span>
    </Link>
  );
}
