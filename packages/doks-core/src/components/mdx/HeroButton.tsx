import Link from 'next/link';
import type { ReactNode } from 'react';

interface HeroButtonProps {
  href: string;
  variant?: 'primary' | 'ghost';
  children: ReactNode;
}

export default function HeroButton({ href, variant = 'primary', children }: HeroButtonProps) {
  const cls = variant === 'ghost' ? 'hbtn hbtn-g' : 'hbtn hbtn-w';
  return (
    <Link className={cls} href={href}>
      {children}
    </Link>
  );
}
