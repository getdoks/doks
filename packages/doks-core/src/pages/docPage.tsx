import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import matter from "gray-matter";

import {
  getAllDocs,
  getDocBySlug,
  getDocNeighbors,
  getDocSource,
  extractToc,
} from "../lib/docs";
import { getBundledMap } from "../runtime/content";
import { rehypeJsxHeadingSlugs } from "../lib/rehypeJsxHeadingSlugs";
import { SiteName, GithubUrl } from "../components/mdx/Brand";
import DocPageRail from "../components/DocPageRail";
import PrevNext from "../components/PrevNext";
import CopyPage from "../components/CopyPage";
import Chunk from "../components/Chunk";
import Hero from "../components/mdx/Hero";
import HeroButton from "../components/mdx/HeroButton";
import { QJump, QCard } from "../components/mdx/QJump";
import Callout from "../components/mdx/Callout";
import { Tabs, Tab } from "../components/mdx/Tabs";
import CodeBlock from "../components/mdx/CodeBlock";
import { Steps, Step } from "../components/mdx/Steps";
import Figure from "../components/mdx/Figure";
import SemanticSearch from "../components/SemanticSearch";
import { isValidElement, type ReactElement, type ReactNode } from "react";

function MdxPre({ children }: { children: ReactNode }) {
  let lang = "text";
  let codeChildren: ReactNode = children;
  if (
    isValidElement(children) &&
    typeof (
      children as ReactElement<{ className?: string; children?: ReactNode }>
    ).props === "object"
  ) {
    const codeEl = children as ReactElement<{
      className?: string;
      children?: ReactNode;
    }>;
    const className = codeEl.props.className ?? "";
    const match = /language-([\w-]+)/.exec(className);
    if (match) lang = match[1];
    if (codeEl.props.children !== undefined)
      codeChildren = codeEl.props.children;
  }
  return <CodeBlock language={lang}>{codeChildren}</CodeBlock>;
}

function MdxTable({ children }: { children: ReactNode }) {
  return (
    <div className="tw">
      <table>{children}</table>
    </div>
  );
}

const mdxComponents = {
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
  SiteName,
  GithubUrl,
  pre: MdxPre,
  table: MdxTable,
};

/**
 * Static params for the doc route. Consumers opt into SSG by re-exporting
 * this from their `app/docs/[[...slug]]/page.tsx`. The default page
 * itself is dynamic (renders from the bundled content map at request
 * time on edge / Node), which avoids the OpenNext incremental cache
 * dependency on Cloudflare. Re-export this function to flip back to
 * fully static rendering on Node hosts.
 */
export async function generateStaticParams() {
  return getAllDocs().map((d) => ({
    slug: d.slug.length ? d.slug : undefined,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const doc = getDocBySlug(slug ?? []);
  if (!doc) return {};
  return {
    title: doc.frontmatter.title,
    description: doc.frontmatter.description,
  };
}

export default async function docPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const slugArr = slug ?? [];
  const doc = getDocBySlug(slugArr);
  if (!doc) notFound();

  // Prefer the precompiled Component (schema 2+, edge-runtime safe).
  // Fall back to runtime MDX compilation only when the bundled map is
  // missing the Component (schema 1 gen files, or fs-only legacy
  // consumers). The fallback uses next-mdx-remote/rsc, which calls
  // `new Function()` at request time and DOES NOT WORK on Cloudflare
  // Workers / V8 isolates. Run `doks build:content` to regenerate.
  const bundled = getBundledMap();
  const target = slugArr.join("/");
  const bundledDoc = bundled?.docs.find((d) => d.slug.join("/") === target);
  const PrecompiledComponent = bundledDoc?.Component as
    | ((props: { components?: Record<string, unknown> }) => ReactNode)
    | undefined;

  const raw = bundledDoc?.raw ?? getDocSource(slugArr);
  if (!raw) notFound();
  const { content } = matter(raw);
  const toc = extractToc(raw);
  const fm = doc.frontmatter;
  const { prev, next } = getDocNeighbors(slugArr);

  const rendered = PrecompiledComponent ? (
    <PrecompiledComponent components={mdxComponents} />
  ) : (
    <MDXRemote
      source={content}
      components={mdxComponents}
      options={{
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [
            rehypeSlug,
            rehypeJsxHeadingSlugs,
            [rehypeAutolinkHeadings, { behavior: "wrap" }],
          ],
        },
      }}
    />
  );

  const isHero = fm.eyebrow;

  return (
    <>
      <main className="main">
        {isHero ? (
          <>
            {rendered}
            <div className="content content-pn">
              <PrevNext prev={prev} next={next} />
            </div>
          </>
        ) : (
          <div className="content">
            <div className="sec">
              {fm.category && (
                <div className="sec-eye">
                  {fm.category.replace(/[-_]/g, " ")}
                </div>
              )}
              <div className="sec-h2-row">
                <h2 className="sec-h2">
                  {fm.title} <a href="#top">#</a>
                </h2>
                <CopyPage source={content} title={fm.title} />
              </div>
              {fm.description && <p className="sec-lead">{fm.description}</p>}
              {rendered}
            </div>
            <PrevNext prev={prev} next={next} />
          </div>
        )}
      </main>
      <DocPageRail toc={toc} />
    </>
  );
}
