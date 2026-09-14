import { StreamableFile } from '@nestjs/common';
import { RenderedReport } from '../../domain/document/report-document.js';

// La descarga: el navegador la guarda con su nombre en vez de mostrarla.
export function reportFile(report: RenderedReport): StreamableFile {
  return new StreamableFile(Buffer.from(report.content), {
    type: report.contentType,
    disposition: `attachment; filename="${report.fileName}"`,
    length: report.content.byteLength,
  });
}
