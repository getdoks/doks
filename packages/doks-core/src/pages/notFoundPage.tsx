import type { Metadata } from 'next';
import Hero from '../components/mdx/Hero';
import HeroButton from '../components/mdx/HeroButton';
import { QJump, QCard } from '../components/mdx/QJump';
import Callout from '../components/mdx/Callout';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFoundPage() {
  return (
    <main className="main">
      <Hero
        eyebrow="404 · Page not found"
        title="That page wandered off."
        description="The link might be stale, the slug might have changed, or the page might never have existed. Search the docs or pick a starting point below."
      >
        <HeroButton href="/docs">Go to docs</HeroButton>
        <HeroButton href="/" variant="ghost">
          Home →
        </HeroButton>
      </Hero>

      <div className="content">
        <Callout type="tip" title="Try search">
          Press <kbd>⌘K</kbd> (or <kbd>Ctrl+K</kbd>) to open Spotlight and
          search the entire docs corpus by meaning, not just by exact title.
        </Callout>

        <div className="sec">
          <div className="sec-eye">Popular destinations</div>
          <h2 className="sec-h2">Pick up where you meant to land.</h2>

          <QJump>
            <QCard
              href="/docs/getting-started/install"
              title="Install"
              description="Scaffold a new doks project with create-doks."
            />
            <QCard
              href="/docs/getting-started/quickstart"
              title="Quickstart"
              description="Five-minute walkthrough. Ingest and serve."
            />
            <QCard
              href="/docs/samples"
              title="Samples"
              description="Banner, callouts, code, full-page archetypes."
            />
            <QCard
              href="/docs/reference/site-config"
              title="Reference"
              description="Site config, MDX components, search API."
            />
          </QJump>
        </div>
      </div>
    </main>
  );
}
