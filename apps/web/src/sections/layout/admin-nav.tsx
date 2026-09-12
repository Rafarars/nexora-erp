'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Administracion de la empresa: quien entra y que puede hacer. No compite por
// espacio con los modulos del negocio, y la cuenta propia vive en el menu del nombre.
const SECTIONS = [
  { href: '/administracion/usuarios', label: 'Usuarios', testId: 'admin-usuarios' },
  { href: '/administracion/roles', label: 'Roles', testId: 'admin-roles' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="sm:w-48 sm:shrink-0" aria-label="Administración" data-testid="admin-nav">
      <ul className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
        {SECTIONS.map((section) => {
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
