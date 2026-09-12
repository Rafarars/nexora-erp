'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Solo los modulos del negocio: aqui creceran inventario, ventas y compras. La
// administracion vive en el menu de la cuenta para no mezclarse con ellos.
const MODULES = [{ href: '/', label: 'Panel', testId: 'nav-panel' }];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Secciones" data-testid="sidebar">
      {MODULES.map((module) => (
        <SidebarLink key={module.href} {...module} active={pathname === module.href} />
      ))}

    </nav>
  );
}

function SidebarLink({
  href,
  label,
  testId,
  active,
}: {
  href: string;
  label: string;
  testId: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      className={`block rounded-md px-3 py-2 text-sm ${
        active ? 'bg-surface font-medium' : 'text-muted hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
