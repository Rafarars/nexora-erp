import { SectionNav } from '@/sections/shared/section-nav';
import { visibleCatalogSections } from '@/modules/catalog/domain/catalog-sections';
import { requireSession } from '@/shared/session/current-session';

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Catálogo</h1>
        <p className="text-muted mt-1 text-sm">Lo que la empresa compra, vende y guarda, y dónde lo guarda.</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SectionNav
          label="Catálogo"
          testId="catalog-nav"
          sections={visibleCatalogSections(session).map(({ href, label, testId }) => ({ href, label, testId }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
