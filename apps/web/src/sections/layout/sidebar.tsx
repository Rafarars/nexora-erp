'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Los modulos del negocio. Aqui creceran inventario, ventas y compras: por eso la
// administracion del sistema no vive en esta lista, o acabarian mezclados.
const MODULES = [{ href: '/', label: 'Panel', testId: 'nav-panel' }];

const SETTINGS = { href: '/administracion', label: 'Administración', testId: 'nav-administracion' };

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Secciones" data-testid="sidebar">
      {MODULES.map((module) => (
        <SidebarLink key={module.href} {...module} active={pathname === module.href} />
      ))}

      <div className="pt-4">
        <SidebarLink {...SETTINGS} active={pathname.startsWith(SETTINGS.href)} />
      </div>
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
