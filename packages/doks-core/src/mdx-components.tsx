import type { MDXComponents } from 'mdx/types';
import Chunk from './components/Chunk';
import Hero from './components/mdx/Hero';
import HeroButton from './components/mdx/HeroButton';
import { QJump, QCard } from './components/mdx/QJump';
import Callout from './components/mdx/Callout';
import { Tabs, Tab } from './components/mdx/Tabs';
import CodeBlock from './components/mdx/CodeBlock';
import { Steps, Step } from './components/mdx/Steps';
import Figure from './components/mdx/Figure';
import SemanticSearch from './components/SemanticSearch';

export const mdxComponents: MDXComponents = {
  Chunk,
  Hero,
  HeroButton,
  QJump,
  QCard,
  Callout,
  Tabs,
  Tab,
  Steps,
  Step,
  Figure,
  SemanticSearch,
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...mdxComponents,
    ...components,
  };
}
