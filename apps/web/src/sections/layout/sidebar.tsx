'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Solo los modulos del negocio: aqui crecera cuentas por cobrar. La
// administracion vive en el menu de la cuenta para no mezclarse con ellos.
const PANEL = { href: '/', label: 'Panel', testId: 'nav-panel' };
const CATALOG = { href: '/catalogo', label: 'Catálogo', testId: 'nav-catalogo' };
const INVENTORY = { href: '/inventario', label: 'Inventario', testId: 'nav-inventario' };
const PURCHASING = { href: '/compras', label: 'Compras', testId: 'nav-compras' };
const SALES = { href: '/ventas', label: 'Ventas', testId: 'nav-ventas' };

// Cada modulo aparece solo si el rol puede ver algo dentro. Un modulo se marca activo
// en todas sus secciones, no solo en su portada.
export function Sidebar({
  showCatalog,
  showInventory,
  showPurchasing,
  showSales,
}: {
  showCatalog: boolean;
  showInventory: boolean;
  showPurchasing: boolean;
  showSales: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Secciones" data-testid="sidebar">
      <SidebarLink {...PANEL} active={pathname === PANEL.href} />
      {showCatalog ? <SidebarLink {...CATALOG} active={pathname.startsWith(CATALOG.href)} /> : null}
      {showInventory ? <SidebarLink {...INVENTORY} active={pathname.startsWith(INVENTORY.href)} /> : null}
      {showPurchasing ? <SidebarLink {...PURCHASING} active={pathname.startsWith(PURCHASING.href)} /> : null}
      {showSales ? <SidebarLink {...SALES} active={pathname.startsWith(SALES.href)} /> : null}
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
