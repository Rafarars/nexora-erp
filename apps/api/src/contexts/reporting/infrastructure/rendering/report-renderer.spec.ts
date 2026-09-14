import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { ReportDocument } from '../../domain/document/report-document.js';
import { formatCell } from './report-values.js';
import { PdfExcelReportRenderer } from './report-renderer.js';

const document: ReportDocument = {
  fileName: 'ventas-por-cliente-2026-03-01-a-2026-03-31',
  title: 'Ventas por cliente',
  subtitle: ['Acme Industrial', 'Del 2026-03-01 al 2026-03-31'],
  columns: [
    { key: 'customer', label: 'Cliente', kind: 'text' },
    { key: 'invoices', label: 'Facturas', kind: 'integer' },
    { key: 'total', label: 'Total', kind: 'amount' },
  ],
  rows: [{ customer: 'Comercial Delta', invoices: 2, total: 1234.5 }],
  totals: { customer: 'Total', invoices: 2, total: 1234.5 },
};

describe('PdfExcelReportRenderer', () => {
  it('writes an Excel whose cells hold numbers, not text', async () => {
    const rendered = await new PdfExcelReportRenderer().render(document, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(rendered.content) as never);
    const sheet = workbook.worksheets[0];

    expect(rendered.fileName).toBe('ventas-por-cliente-2026-03-01-a-2026-03-31.xlsx');
    expect(sheet.getCell('A1').value).toBe('Ventas por cliente');
    expect(sheet.getRow(5).values).toEqual([undefined, 'Cliente', 'Facturas', 'Total']);
    expect(sheet.getRow(6).values).toEqual([undefined, 'Comercial Delta', 2, 1234.5]);
    expect(sheet.getColumn(3).numFmt).toBe('#,##0.00');
  });

  it('writes a PDF', async () => {
    const rendered = await new PdfExcelReportRenderer().render(document, 'pdf');

    expect(rendered.contentType).toBe('application/pdf');
    expect(Buffer.from(rendered.content.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('prints amounts with a decimal comma and grouped thousands', () => {
    expect(formatCell(1234.5, 'amount')).toBe('1.234,50');
    expect(formatCell(2.5, 'quantity')).toBe('2,5');
    expect(formatCell(null, 'amount')).toBe('');
  });
});
