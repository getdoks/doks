import type { ReactNode } from 'react';

interface ChunkProps {
  id: string;
  importance?: number;
  tags?: string[];
  children: ReactNode;
}

export default function Chunk({ id, importance, tags, children }: ChunkProps) {
  return (
    <section
      id={id}
      data-chunk-id={id}
      data-chunk-importance={importance}
      data-chunk-tags={tags?.join(',')}
    >
      {children}
    </section>
  );
}
