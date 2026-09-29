import { SectionNav } from '@/sections/shared/section-nav';
import { visiblePayablesSections } from '@/modules/payables/domain/payables-sections';
import { requireSession } from '@/shared/session/current-session';

export default async function PayablesLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Cuentas por pagar</h1>
        <p className="text-muted mt-1 text-sm">Qué se le debe a cada proveedor, desde cuándo, qué se le pagó y cuánto crédito queda.</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SectionNav
          label="Cuentas por pagar"
          testId="payables-nav"
          sections={visiblePayablesSections(session).map(({ href, label, testId }) => ({ href, label, testId }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
