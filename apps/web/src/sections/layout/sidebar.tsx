'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Solo los modulos del negocio: aqui creceran inventario, ventas y compras. La
// administracion vive en el menu de la cuenta para no mezclarse con ellos.
const PANEL = { href: '/', label: 'Panel', testId: 'nav-panel' };
const CATALOG = { href: '/catalogo', label: 'Catálogo', testId: 'nav-catalogo' };

// Cada modulo aparece solo si el rol puede ver algo dentro. Un modulo se marca activo
// en todas sus secciones, no solo en su portada.
export function Sidebar({ showCatalog }: { showCatalog: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Secciones" data-testid="sidebar">
      <SidebarLink {...PANEL} active={pathname === PANEL.href} />
      {showCatalog ? <SidebarLink {...CATALOG} active={pathname.startsWith(CATALOG.href)} /> : null}
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
