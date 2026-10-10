import { describe, expect, it } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import type { Session } from '../../access/domain/session';
import { readableAccountingError } from './accounting-error';
import { visibleAccountingSections } from './accounting-sections';

describe('accounting domain and web helpers', () => {
  it('translates domain and access errors to user-friendly Spanish messages', () => {
    expect(
      readableAccountingError(
        AccessError.fromStatus(404, { code: 'AccountNotFoundError' }),
        'error',
      ),
    ).toBe('La cuenta contable no existe en esta empresa.');

    expect(
      readableAccountingError(
        AccessError.fromStatus(409, { code: 'AccountCodeAlreadyExistsError' }),
        'error',
      ),
    ).toBe('Ya existe una cuenta con este código en la empresa.');

    expect(
      readableAccountingError(
        AccessError.fromStatus(400, { code: 'AccountCannotAcceptEntriesError' }),
        'error',
      ),
    ).toBe('La cuenta seleccionada es una cuenta de grupo y no acepta asientos directos.');

    expect(
      readableAccountingError(new Error('something went wrong'), 'Error inesperado'),
    ).toBe('Error inesperado');
  });

  it('filters visible sections based on user permissions', () => {
    const adminSession: Session = {
      tenantId: '1',
      tenantName: 'Acme',
      userId: '1',
      name: 'Admin',
      email: 'admin@acme.com',
      grantsAll: true,
      permissions: [],
      availableTenants: [],
    };
    expect(visibleAccountingSections(adminSession)).toHaveLength(1);

    const withPermission = {
      ...adminSession,
      grantsAll: false,
      permissions: ['accounting.accounts.search'],
    };
    expect(visibleAccountingSections(withPermission)).toHaveLength(1);
    expect(visibleAccountingSections(withPermission)[0].href).toBe('/contabilidad/cuentas');

    const withoutPermission = {
      ...adminSession,
      grantsAll: false,
      permissions: ['sales.orders.search'],
    };
    expect(visibleAccountingSections(withoutPermission)).toHaveLength(0);
  });
});
