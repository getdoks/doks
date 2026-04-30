import type { ReactNode } from 'react';

interface HeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function Hero({ eyebrow, title, description, children }: HeroProps) {
  return (
    <div className="hero">
      {eyebrow && <div className="hero-eye">{eyebrow}</div>}
      <h1>{title}</h1>
      {description && <p className="hero-desc">{description}</p>}
      {children && <div className="hero-btns">{children}</div>}
    </div>
  );
}
