import { SectionNav } from '@/sections/shared/section-nav';
import { visibleSalesSections } from '@/modules/sales/domain/sales-sections';
import { requireSession } from '@/shared/session/current-session';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Ventas</h1>
        <p className="text-muted mt-1 text-sm">
          Qué pidió cada cliente, qué queda reservado, qué salió de las bodegas y qué se facturó.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SectionNav
          label="Ventas"
          testId="sales-nav"
          sections={visibleSalesSections(session).map(({ href, label, testId }) => ({ href, label, testId }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
