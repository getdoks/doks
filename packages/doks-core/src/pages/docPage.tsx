import fs from "node:fs";
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
  extractToc,
} from "../lib/docs";
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
import GithubSlugger from "github-slugger";
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

// rehype-slug only adds ids to standard HAST `element` nodes. Author-written
// JSX headings like `<h2 className="sec-h2">…</h2>` come through as
// `mdxJsxFlowElement` nodes and are skipped, leaving them with no anchor
// target. TOC links pointed to nothing. This walks the tree and assigns
// slug ids to every h1–h6 the standard plugin missed.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;
function rehypeJsxHeadingSlugs() {
  return (tree: AnyNode) => {
    const slugger = new GithubSlugger();

    const textOf = (node: AnyNode): string => {
      if (!node) return "";
      if (node.type === "text") return String(node.value ?? "");
      if (Array.isArray(node.children)) {
        return node.children.map(textOf).join("");
      }
      return "";
    };

    const walk = (node: AnyNode) => {
      const isStdHeading =
        node.type === "element" && /^h[1-6]$/.test(node.tagName);
      const isJsxHeading =
        (node.type === "mdxJsxFlowElement" ||
          node.type === "mdxJsxTextElement") &&
        /^h[1-6]$/.test(node.name);

      if (isStdHeading) {
        const props = (node.properties ??= {});
        if (!props.id) {
          const text = textOf(node).trim();
          if (text) props.id = slugger.slug(text);
        }
      } else if (isJsxHeading) {
        const attrs: AnyNode[] = (node.attributes ??= []);
        const hasId = attrs.some(
          (a) => a.type === "mdxJsxAttribute" && a.name === "id",
        );
        if (!hasId) {
          const text = textOf(node).trim();
          if (text) {
            attrs.push({
              type: "mdxJsxAttribute",
              name: "id",
              value: slugger.slug(text),
            });
          }
        }
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      }
    };

    walk(tree);
  };
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
  const doc = getDocBySlug(slug ?? []);
  if (!doc) notFound();

  const raw = fs.readFileSync(doc.filePath, "utf8");
  const { content } = matter(raw);
  const toc = extractToc(raw);
  const fm = doc.frontmatter;
  const { prev, next } = getDocNeighbors(slug ?? []);

  const rendered = (
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
