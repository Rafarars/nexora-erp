import { describe, expect, it } from 'vitest';
import {
  ACCESS_PERMISSIONS,
  CATALOG_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  PURCHASING_PERMISSIONS,
  RECEIVABLES_PERMISSIONS,
  REPORTS_PERMISSIONS,
  SALES_PERMISSIONS,
  SYSTEM_PERMISSIONS,
} from './permissions.catalog.js';
import { PermissionCode } from './permission-code.vo.js';

describe('permissions catalog', () => {
  // Un codigo invalido solo se descubriria al asignarlo a un rol, en produccion.
  it.each(SYSTEM_PERMISSIONS)('$code is a valid permission code', ({ code }) => {
    expect(PermissionCode.of(code).value).toBe(code);
  });

  it('has no duplicated codes across contexts', () => {
    const codes = SYSTEM_PERMISSIONS.map((permission) => permission.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('describes every permission, because the description is what a person reads', () => {
    for (const { description } of SYSTEM_PERMISSIONS) {
      expect(description.trim().length).toBeGreaterThan(0);
    }
  });

  // Cada lista es de su contexto: el prefijo es el modulo con el que la interfaz agrupa.
  it.each(ACCESS_PERMISSIONS)('$code belongs to the access context', ({ code }) => {
    expect(code.startsWith('access.')).toBe(true);
  });

  it.each(CATALOG_PERMISSIONS)('$code belongs to the catalog context', ({ code }) => {
    expect(code.startsWith('catalog.')).toBe(true);
  });

  it.each(INVENTORY_PERMISSIONS)('$code belongs to the inventory context', ({ code }) => {
    expect(code.startsWith('inventory.')).toBe(true);
  });

  it.each(SALES_PERMISSIONS)('$code belongs to the sales context', ({ code }) => {
    expect(code.startsWith('sales.')).toBe(true);
  });

  it.each(PURCHASING_PERMISSIONS)('$code belongs to the purchasing context', ({ code }) => {
    expect(code.startsWith('purchasing.')).toBe(true);
  });

  it.each(RECEIVABLES_PERMISSIONS)('$code belongs to the receivables context', ({ code }) => {
    expect(code.startsWith('receivables.')).toBe(true);
  });

  it.each(REPORTS_PERMISSIONS)('$code belongs to the reports context', ({ code }) => {
    expect(code.startsWith('reports.')).toBe(true);
  });

  it('is exactly the permissions of every context, nothing more', () => {
    expect(SYSTEM_PERMISSIONS).toEqual([...ACCESS_PERMISSIONS, ...CATALOG_PERMISSIONS, ...INVENTORY_PERMISSIONS, ...PURCHASING_PERMISSIONS, ...SALES_PERMISSIONS, ...RECEIVABLES_PERMISSIONS, ...REPORTS_PERMISSIONS]);
  });
});
