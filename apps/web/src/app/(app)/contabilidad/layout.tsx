import { SectionNav } from '@/sections/shared/section-nav';
import { visibleAccountingSections } from '@/modules/accounting/domain/accounting-sections';
import { requireSession } from '@/shared/session/current-session';

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Contabilidad</h1>
        <p className="text-muted mt-1 text-sm">Partida doble generada desde las operaciones, catálogo de cuentas y estados financieros.</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SectionNav
          label="Contabilidad"
          testId="accounting-nav"
          sections={visibleAccountingSections(session).map(({ href, label, testId }) => ({ href, label, testId }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
