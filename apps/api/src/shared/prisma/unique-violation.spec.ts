import { describe, expect, it } from 'vitest';
import { violatedUniqueFields, violates } from './unique-violation.js';

// La forma real que devuelve Prisma 7 con el adaptador de PostgreSQL, capturada de un
// duplicado de verdad. Si una version futura la cambia, el contrato contra la base lo
// detecta; esta prueba fija como se lee.
function adapterError(index: string) {
  return {
    code: 'P2002',
    meta: {
      modelName: 'MeasurementUnit',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { originalCode: '23505', kind: 'UniqueConstraintViolation', constraint: { index } },
      },
    },
  };
}

describe('violates', () => {
  it('recognizes the column from the index name the adapter reports', () => {
    const error = adapterError('measurement_units_tenant_id_abbreviation_key');

    expect(violates(error, 'abbreviation')).toBe(true);
    expect(violates(error, 'name')).toBe(false);
  });

  // `modelName` contiene "name": comparar el JSON entero daria un falso positivo.
  it('does not mistake the model name for the name column', () => {
    expect(violates(adapterError('measurement_units_tenant_id_code_key'), 'name')).toBe(false);
  });

  it('reads the classic target list too', () => {
    expect(violates({ code: 'P2002', meta: { target: ['tenantId', 'sku'] } }, 'sku')).toBe(true);
  });

  it('ignores any error that is not a unique violation', () => {
    expect(violatedUniqueFields(new Error('boom'))).toBeNull();
    expect(violates({ code: 'P2003', meta: {} }, 'name')).toBe(false);
    expect(violates(null, 'name')).toBe(false);
  });
});
