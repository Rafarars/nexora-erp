import { SectionNav } from '@/sections/shared/section-nav';
import { visiblePurchasingSections } from '@/modules/purchasing/domain/purchasing-sections';
import { requireSession } from '@/shared/session/current-session';

export default async function PurchasingLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Compras</h1>
        <p className="text-muted mt-1 text-sm">
          Qué se le pidió a cada proveedor, qué viene en camino y qué ya entró a las bodegas.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SectionNav
          label="Compras"
          testId="purchasing-nav"
          sections={visiblePurchasingSections(session).map(({ href, label, testId }) => ({ href, label, testId }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
