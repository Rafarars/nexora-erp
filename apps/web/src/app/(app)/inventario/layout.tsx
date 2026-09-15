import { SectionNav } from '@/sections/shared/section-nav';
import { visibleInventorySections } from '@/modules/inventory/domain/inventory-sections';
import { requireSession } from '@/shared/session/current-session';

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Inventario</h1>
        <p className="text-muted mt-1 text-sm">
          Los artículos, cuánto hay de cada uno en cada bodega y el kardex que explica cómo se llegó ahí.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SectionNav
          label="Inventario"
          testId="inventory-nav"
          sections={visibleInventorySections(session).map(({ href, label, testId }) => ({ href, label, testId }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
