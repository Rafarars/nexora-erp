import { describe, expect, it } from 'vitest';
import { ACCESS_PERMISSIONS } from './permissions.catalog.js';
import { PermissionCode } from './permission-code.vo.js';

describe('access permissions catalog', () => {
  // Un codigo invalido solo se descubriria al asignarlo a un rol, en produccion.
  it.each(ACCESS_PERMISSIONS)('$code is a valid permission code', ({ code }) => {
    expect(PermissionCode.of(code).value).toBe(code);
  });

  it('has no duplicated codes', () => {
    const codes = ACCESS_PERMISSIONS.map((permission) => permission.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('describes every permission, because the description is what a person reads', () => {
    for (const { description } of ACCESS_PERMISSIONS) {
      expect(description.trim().length).toBeGreaterThan(0);
    }
  });

  // Todos pertenecen a este contexto: un permiso de inventario se declara en el suyo.
  it.each(ACCESS_PERMISSIONS)('$code belongs to the access context', ({ code }) => {
    expect(code.startsWith('access.')).toBe(true);
  });
});
