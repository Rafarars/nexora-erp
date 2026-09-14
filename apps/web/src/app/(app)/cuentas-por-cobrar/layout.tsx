import { SectionNav } from '@/sections/shared/section-nav';
import { visibleReceivablesSections } from '@/modules/receivables/domain/receivables-sections';
import { requireSession } from '@/shared/session/current-session';

export default async function ReceivablesLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Cuentas por cobrar</h1>
        <p className="text-muted mt-1 text-sm">Qué debe cada cliente, desde cuándo, qué se le cobró y cuánto crédito le queda.</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SectionNav
          label="Cuentas por cobrar"
          testId="receivables-nav"
          sections={visibleReceivablesSections(session).map(({ href, label, testId }) => ({ href, label, testId }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
