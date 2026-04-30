'use client';

import { useEffect } from 'react';
import Hero from '../components/mdx/Hero';
import HeroButton from '../components/mdx/HeroButton';
import Callout from '../components/mdx/Callout';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[doks] route error:', error);
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <main className="main">
      <Hero
        eyebrow="500 · Something broke"
        title="That request hit a bug."
        description="The error has been logged. You can retry the page, head home, or open Spotlight to find what you came for."
      >
        <button
          type="button"
          className="hbtn hbtn-w"
          onClick={reset}
          style={{ cursor: 'pointer' }}
        >
          Try again
        </button>
        <HeroButton href="/" variant="ghost">
          Home →
        </HeroButton>
      </Hero>

      <div className="content">
        <Callout type="warn" title="What just happened">
          A runtime error escaped from this page. Reloading often fixes
          transient issues. If it keeps happening, the digest below helps
          maintainers find the matching log line.
          {error.digest && (
            <>
              {' '}
              <strong>Digest:</strong> <code>{error.digest}</code>
            </>
          )}
        </Callout>

        {isDev && (
          <Callout type="note" title="Dev-only error details">
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                fontFamily: 'var(--mono)',
                margin: 0,
                color: 'var(--text)',
              }}
            >
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </Callout>
        )}
      </div>
    </main>
  );
}
