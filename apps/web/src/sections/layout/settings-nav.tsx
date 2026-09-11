'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Navegacion propia de la configuracion, como el `settings/` de Laravel: lo que
// administra el sistema no compite por espacio con los modulos del negocio.
const SECTIONS = [
  { href: '/configuracion/usuarios', label: 'Usuarios', testId: 'settings-usuarios' },
  { href: '/configuracion/roles', label: 'Roles', testId: 'settings-roles' },
  { href: '/configuracion/perfil', label: 'Mi perfil', testId: 'settings-perfil' },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="sm:w-48 sm:shrink-0" aria-label="Configuración" data-testid="settings-nav">
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
