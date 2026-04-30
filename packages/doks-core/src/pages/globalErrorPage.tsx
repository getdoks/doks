'use client';

// Top-level error boundary. Used when the root layout itself throws. At
// that point the framework's CSS may not have loaded, so this file ships
// its own minimal styling and its own <html>/<body> wrapper (Next.js
// requirement for global-error.tsx).

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[doks] global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: '#fafafa',
          color: '#1a1a1a',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#6b6b6b',
              marginBottom: 12,
            }}
          >
            Fatal · application crashed
          </div>
          <h1
            style={{
              fontSize: 28,
              lineHeight: 1.2,
              margin: '0 0 12px',
              fontWeight: 600,
            }}
          >
            Something went seriously wrong.
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: '#525252',
              margin: '0 0 24px',
            }}
          >
            The page crashed before the layout could render. This usually
            clears with a reload. If it persists, the digest below helps
            maintainers locate the matching log line.
          </p>

          {error.digest && (
            <div
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                color: '#525252',
                marginBottom: 24,
                padding: '8px 12px',
                background: '#f1f1f1',
                borderRadius: 6,
                display: 'inline-block',
              }}
            >
              digest: {error.digest}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '10px 18px',
                fontSize: 14,
                fontWeight: 500,
                color: '#fff',
                background: '#1a1a1a',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{
                padding: '10px 18px',
                fontSize: 14,
                fontWeight: 500,
                color: '#1a1a1a',
                background: 'transparent',
                border: '1px solid #d4d4d4',
                borderRadius: 8,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
