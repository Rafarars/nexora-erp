import { describe, expect, it } from 'vitest';
import type { Session } from '../../access/domain/session';
import { AccessError } from '../../access/domain/access-error';
import { downloadHref, exportPath, monthToDate, pageLabel } from './reports';
import type { ReportPage } from './reports';
import { readableReportsError } from './reports-error';
import { visibleReportSections } from './reports-sections';

const query = (href: string) => new URLSearchParams(href.split('?')[1]);

describe('report downloads', () => {
  it('builds the month to date', () => {
    expect(monthToDate('2026-09-14')).toEqual({ from: '2026-09-01', to: '2026-09-14' });
  });

  it('turns the Spanish link into the API export route', () => {
    expect(exportPath(query(downloadHref('antiguedad', 'xlsx')))).toBe('/api/v1/reports/receivables-aging/export?format=xlsx');
    expect(exportPath(query(downloadHref('estado-de-cuenta', 'pdf', { cliente: 'c-1' })))).toBe('/api/v1/reports/customers/c-1/statement/export?format=pdf');
    expect(exportPath(query(downloadHref('ventas-por-cliente', 'pdf', { desde: '2026-09-01', hasta: '2026-09-14' })))).toBe(
      '/api/v1/reports/sales-by-customer/export?format=pdf&from=2026-09-01&to=2026-09-14',
    );
    expect(exportPath(query(downloadHref('valuacion-inventario', 'xlsx', { bodega: 'w-1' })))).toBe('/api/v1/reports/inventory-valuation/export?format=xlsx&warehouseId=w-1');
  });

  // La ruta de descarga no es un tunel hacia la API.
  it('forwards nothing it does not know', () => {
    expect(exportPath(new URLSearchParams({ reporte: 'usuarios', formato: 'pdf' }))).toBeNull();
    expect(exportPath(new URLSearchParams({ reporte: 'antiguedad', formato: 'html' }))).toBeNull();
    expect(exportPath(new URLSearchParams({ reporte: 'estado-de-cuenta', formato: 'pdf' }))).toBeNull();
    expect(exportPath(new URLSearchParams({ reporte: 'estado-de-cuenta', formato: 'pdf', cliente: '../../users' }))).toBe('/api/v1/reports/customers/..%2F..%2Fusers/statement/export?format=pdf');
  });

  it('translates report errors', () => {
    expect(readableReportsError(AccessError.fromStatus(400, { code: 'ReportPeriodTooLongError', fields: [], message: 'x' }), 'fallo')).toBe('El periodo no puede ser mayor a un año.');
  });

  it('shows only the reports the role can read', () => {
    const session = { permissions: ['reports.sales.search'], grantsAll: false } as unknown as Session;

    expect(visibleReportSections(session).map((section) => section.label)).toEqual(['Ventas por cliente']);
  });
});

describe('pageLabel', () => {
  const page = (overrides: Partial<ReportPage>): ReportPage => ({ total: 120, limit: 50, offset: 0, rows: 50, hasMore: true, ...overrides });

  it('hides itself when everything fits in one page', () => {
    expect(pageLabel(page({ total: 45, rows: 45, hasMore: false })).visible).toBe(false);
  });

  it('counts the rows of this page against the whole report', () => {
    expect(pageLabel(page({})).label).toBe('1–50 de 120');
    expect(pageLabel(page({ offset: 50 })).label).toBe('51–100 de 120');
    expect(pageLabel(page({ offset: 100, rows: 20, hasMore: false })).label).toBe('101–120 de 120');
  });

  // Se llega con una direccion guardada de la pagina 2 cuando ya quedan menos filas. Antes no se
  // pintaba nada: la tabla salia vacia y no habia ningun enlace para volver.
  it('still shows itself when the offset ran past the total, so there is a way back', () => {
    const past = pageLabel(page({ total: 45, offset: 50, rows: 0, hasMore: false }));

    expect(past.visible).toBe(true);
    expect(past.label).toBe('Sin filas en esta página, de 45');
  });

  it('never writes a range beyond the total', () => {
    expect(pageLabel(page({ total: 120, offset: 200, rows: 0, hasMore: false })).label).not.toContain('201');
  });
});
