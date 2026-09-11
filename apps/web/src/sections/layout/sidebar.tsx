'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/', label: 'Panel', testId: 'nav-panel' },
  { href: '/usuarios', label: 'Usuarios', testId: 'nav-usuarios' },
  { href: '/roles', label: 'Roles', testId: 'nav-roles' },
  // Vive fuera de la zona con sesion: se consulta cuando el sistema esta caido.
  { href: '/estado', label: 'Estado', testId: 'nav-estado' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Secciones" data-testid="sidebar">
      {SECTIONS.map((section) => {
        const active = pathname === section.href;

        return (
          <Link
            key={section.href}
            href={section.href}
            data-testid={section.testId}
            aria-current={active ? 'page' : undefined}
            className={`block rounded-md px-3 py-2 text-sm ${
              active ? 'bg-surface font-medium' : 'text-muted hover:text-foreground'
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
