'use client';

import { useState } from 'react';

interface CopyPageProps {
  source: string;
  title: string;
}

export default function CopyPage({ source, title }: CopyPageProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const text = `# ${title}\n\n${source.trim()}\n`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="page-actions">
      <button
        className={`page-act${copied ? ' ok' : ''}`}
        onClick={copy}
        title="Copy this page as Markdown"
        aria-label="Copy page as Markdown"
      >
        {copied ? (
          <>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 6.5l2.5 2.5 5-5.5" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.5" y="3.5" width="6.5" height="7" rx="1" />
              <path d="M2 7.5V2.5a1 1 0 011-1H7" />
            </svg>
            Copy page
          </>
        )}
      </button>
    </div>
  );
}
