import ExcelJS from 'exceljs';
import { PDFParse } from 'pdf-parse';

// Leen lo que el sistema genero, como lo leeria quien lo abre: celdas del Excel y texto del PDF.
export async function excelRows(content: Buffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(content as never);

  const rows: unknown[][] = [];

  workbook.worksheets[0].eachRow((row) => rows.push((row.values as unknown[]).slice(1)));

  return rows;
}

export async function pdfText(content: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(content) });

  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}
