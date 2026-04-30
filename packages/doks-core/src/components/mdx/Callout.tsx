import type { ReactNode } from 'react';

type CalloutType = 'tip' | 'warn' | 'note';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

const ICONS: Record<CalloutType, ReactNode> = {
  tip: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5.5" cy="10.5" r="2.5" />
      <path d="M7.5 9l6.5-6.5M11.5 5l1.5 1.5" />
    </svg>
  ),
  warn: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1.5L1.5 13.5h13L8 1.5zM8 6v3.5M8 11.5v.5" />
    </svg>
  ),
  note: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v3.5M8 11v.01" />
    </svg>
  ),
};

export default function Callout({ type = 'note', title, children }: CalloutProps) {
  return (
    <div className={`cal ${type}`}>
      <span className="cal-i">{ICONS[type]}</span>
      <div className="cal-b">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}
