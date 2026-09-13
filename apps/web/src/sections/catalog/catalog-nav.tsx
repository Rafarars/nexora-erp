'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function CatalogNav({ sections }: { sections: { href: string; label: string; testId: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="sm:w-48 sm:shrink-0" aria-label="Catálogo" data-testid="catalog-nav">
      <ul className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
        {sections.map((section) => {
          const active = pathname === section.href;

          return (
            <li key={section.href}>
              <Link
                href={section.href}
                data-testid={section.testId}
                aria-current={active ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                  active ? 'bg-surface font-medium' : 'text-muted hover:text-foreground'
                }`}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
