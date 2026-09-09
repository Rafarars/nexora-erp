import { describe, expect, it } from 'vitest';
import { InvalidUuidError, Uuid } from './uuid.vo.js';

class TenantId extends Uuid {
  static of(value: string): TenantId {
    return new TenantId(value);
  }
}

class UserId extends Uuid {
  static of(value: string): UserId {
    return new UserId(value);
  }
}

const VALID = '8f1a3c2e-4b5d-4e6f-9a7b-1c2d3e4f5a6b';

describe('Uuid', () => {
  it('accepts a valid uuid', () => {
    expect(TenantId.of(VALID).value).toBe(VALID);
  });

  it('rejects a malformed uuid naming the concrete type', () => {
    expect(() => TenantId.of('not-a-uuid')).toThrow(InvalidUuidError);
    expect(() => TenantId.of('not-a-uuid')).toThrow(/TenantId must be a valid UUID/);
  });

  it('rejects an empty value', () => {
    expect(() => TenantId.of('   ')).toThrow(/cannot be empty/);
  });

  // Dos identificadores con el mismo texto pero de distinto tipo NO son iguales:
  // evita comparar por accidente un UserId con un TenantId.
  it('is not equal to a different value object type with the same value', () => {
    expect(TenantId.of(VALID).equals(UserId.of(VALID))).toBe(false);
  });

  it('is equal to the same type with the same value', () => {
    expect(TenantId.of(VALID).equals(TenantId.of(VALID))).toBe(true);
  });
});
