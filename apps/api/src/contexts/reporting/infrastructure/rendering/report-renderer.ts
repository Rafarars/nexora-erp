import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ExportFormat, RenderedReport, ReportDocument, ReportRenderer } from '../../domain/document/report-document.js';
import { excelFormat, formatCell, isNumeric } from './report-values.js';

// Excel prohibe estos caracteres en el nombre de una hoja y no avisa: revienta. El titulo lleva el
// nombre del cliente, asi que uno llamado "Comercial A/B" tumbaba la descarga con un error interno.
// El titulo entero se sigue escribiendo en la primera fila; esto solo bautiza la pestaña.
const sheetName = (title: string) => title.replace(/[*?:\\/[\]]/g, '-').slice(0, 31).trim() || 'Reporte';

// Escribe un documento como PDF (pdfkit, sin navegador) o Excel (exceljs). No decide contenido:
// titulo, columnas, filas y totales llegan hechos.
@Injectable()
export class PdfExcelReportRenderer implements ReportRenderer {
  async render(document: ReportDocument, format: ExportFormat): Promise<RenderedReport> {
    return format === 'xlsx'
      ? { fileName: `${document.fileName}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: await excel(document) }
      : { fileName: `${document.fileName}.pdf`, contentType: 'application/pdf', content: await pdf(document) };
  }
}

// En Excel los numeros van como numeros, no como texto: quien lo abre puede sumar y filtrar.
async function excel(document: ReportDocument): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName(document.title));

  sheet.addRow([document.title]).font = { bold: true, size: 14 };
  for (const line of document.subtitle) sheet.addRow([line]);
  sheet.addRow([]);

  const header = sheet.addRow(document.columns.map((column) => column.label));
  header.font = { bold: true };

  const write = (values: Record<string, unknown>) => sheet.addRow(document.columns.map((column) => values[column.key] ?? null));

  for (const row of document.rows) write(row);

  if (document.totals) write(document.totals).font = { bold: true };

  document.columns.forEach((column, index) => {
    const target = sheet.getColumn(index + 1);

    target.width = Math.max(12, column.label.length + 4, ...document.rows.map((row) => String(row[column.key] ?? '').length + 2));
    const format = excelFormat(column.kind, document.decimals);

    if (format) target.numFmt = format;
  });

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

async function pdf(document: ReportDocument): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'LETTER', layout: document.columns.length > 6 ? 'landscape' : 'portrait', margin: 36, info: { Title: document.title } });
  const chunks: Buffer[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const columnWidth = width / document.columns.length;

  doc.font('Helvetica-Bold').fontSize(14).text(document.title);
  doc.font('Helvetica').fontSize(9);
  for (const line of document.subtitle) doc.text(line);
  doc.moveDown();

  const line = (values: Record<string, unknown>, bold = false) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();

    const y = doc.y;

    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    document.columns.forEach((column, index) => {
      const text = formatCell((values[column.key] ?? null) as string | number | null, column.kind, document.decimals);

      doc.text(text, left + index * columnWidth, y, { width: columnWidth - 4, align: isNumeric(column.kind) ? 'right' : 'left', lineBreak: false, ellipsis: true });
    });
    doc.x = left;
    doc.y = y + 14;
  };

  line(Object.fromEntries(document.columns.map((column) => [column.key, column.label])), true);
  for (const row of document.rows) line(row);
  if (document.totals) line(document.totals, true);
  if (document.rows.length === 0) doc.font('Helvetica').text('Sin datos para este reporte.', left);

  doc.end();

  return done;
}
