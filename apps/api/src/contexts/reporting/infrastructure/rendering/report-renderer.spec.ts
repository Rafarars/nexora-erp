import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { ReportDocument } from '../../domain/document/report-document.js';
import { excelFormat, formatCell } from './report-values.js';
import { PdfExcelReportRenderer } from './report-renderer.js';

const document: ReportDocument = {
  fileName: 'ventas-por-cliente-2026-03-01-a-2026-03-31',
  title: 'Ventas por cliente',
  subtitle: ['Acme Industrial', 'Del 2026-03-01 al 2026-03-31'],
  decimals: 2,
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
    expect(formatCell(1234.5, 'amount', 2)).toBe('1.234,50');
    expect(formatCell(2.5, 'quantity', 2)).toBe('2,5');
    expect(formatCell(null, 'amount', 2)).toBe('');
  });

  // Antes habia un [2, 2] fijo aqui: una empresa con cuatro decimales veia el PDF recortar a dos, y
  // las filas visibles dejaban de sumar el total visible del mismo documento.
  it('writes the amount with the decimals the company configured, so the rows add up to the total', () => {
    expect([formatCell(1.006, 'amount', 4), formatCell(2.012, 'amount', 4)]).toEqual(['1,0060', '2,0120']);
    expect(formatCell(1234.5, 'amount', 0)).toBe('1.235');
  });

  it('gives Excel a number format with those same decimals', () => {
    expect([excelFormat('amount', 4), excelFormat('amount', 2), excelFormat('amount', 0)]).toEqual(['#,##0.0000', '#,##0.00', '#,##0']);
  });
});
