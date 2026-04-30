'use client';

import { useRef, useState, type ReactNode } from 'react';

interface CodeBlockProps {
  language?: string;
  children: ReactNode;
}

export default function CodeBlock({ language = 'text', children }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    const text = preRef.current?.innerText ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="cb">
      <div className="cbh">
        <div className="dots">
          <s /> <s /> <s />
        </div>
        <span className="cblang">{language}</span>
        <button className={`cpbtn${copied ? ' ok' : ''}`} onClick={copy}>
          {copied ? (
            <>
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
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
                width="11"
                height="11"
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
              Copy
            </>
          )}
        </button>
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}
