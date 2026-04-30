import type { ReactNode } from 'react';

interface FigureProps {
  src: string;
  alt: string;
  caption?: ReactNode;
  width?: number;
  height?: number;
}

/**
 * Captioned image. Use it in MDX when you want centred, captioned media:
 *
 * ```mdx
 * <Figure src="/screens/dashboard.png" alt="Dashboard screenshot"
 *         caption="Stack overview after the first apply." />
 * ```
 *
 * For a bare image without a caption, just write standard markdown
 * (`![alt](/path.png)`). The global `.content img` styles apply.
 */
export default function Figure({
  src,
  alt,
  caption,
  width,
  height,
}: FigureProps) {
  return (
    <figure>
      <img src={src} alt={alt} width={width} height={height} loading="lazy" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
