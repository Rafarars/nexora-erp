import { describe, expect, it } from 'vitest';
import { InvalidExportFormatError } from '../errors/reporting.errors.js';
import { exportFormat } from './report-document.js';

describe('exportFormat', () => {
  it('takes pdf and xlsx and nothing else', () => {
    expect(exportFormat('pdf')).toBe('pdf');
    expect(exportFormat('xlsx')).toBe('xlsx');
    expect(() => exportFormat('csv')).toThrow(InvalidExportFormatError);
    expect(() => exportFormat(undefined)).toThrow(InvalidExportFormatError);
  });
});
