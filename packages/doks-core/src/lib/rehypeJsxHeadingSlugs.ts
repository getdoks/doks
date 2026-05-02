// rehype-slug only tags standard HAST `element` nodes. JSX headings
// like `<h2 className="sec-h2">…</h2>` come through as `mdxJsxFlowElement`
// or `mdxJsxTextElement` and get skipped, leaving anchor links pointing
// to nothing. This pass assigns slug ids to every h1–h6 the standard
// plugin missed (both element and JSX flavors).
//
// Used in two places now that 0.3.3+ precompiles MDX:
// 1. The build-time generator (`scripts/buildContent.ts`) so the slug
//    ids end up baked into the compiled module.
// 2. The legacy MDXRemote fallback in `DocPage` for consumers still on
//    the raw-string runtime path.

import GithubSlugger from 'github-slugger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

export function rehypeJsxHeadingSlugs() {
  return (tree: AnyNode) => {
    const slugger = new GithubSlugger();

    const textOf = (node: AnyNode): string => {
      if (!node) return '';
      if (node.type === 'text') return String(node.value ?? '');
      if (Array.isArray(node.children)) {
        return node.children.map(textOf).join('');
      }
      return '';
    };

    const walk = (node: AnyNode) => {
      const isStdHeading =
        node.type === 'element' && /^h[1-6]$/.test(node.tagName);
      const isJsxHeading =
        (node.type === 'mdxJsxFlowElement' ||
          node.type === 'mdxJsxTextElement') &&
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
          (a) => a.type === 'mdxJsxAttribute' && a.name === 'id',
        );
        if (!hasId) {
          const text = textOf(node).trim();
          if (text) {
            attrs.push({
              type: 'mdxJsxAttribute',
              name: 'id',
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
