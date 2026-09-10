import { describe, expect, it } from 'vitest';
import { InvalidPermissionCodeError, PermissionCode } from './permission-code.vo.js';

describe('PermissionCode', () => {
  it('accepts dot separated lowercase segments', () => {
    expect(PermissionCode.of('sales.invoices.create').value).toBe('sales.invoices.create');
  });

  it.each(['sales', 'sales.', '.sales', 'sales..create', 'sales invoices'])(
    'rejects <%s>',
    (candidate) => {
      expect(() => PermissionCode.of(candidate)).toThrow(InvalidPermissionCodeError);
    },
  );
});
