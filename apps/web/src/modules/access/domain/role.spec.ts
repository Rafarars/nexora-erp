import { describe, expect, it } from 'vitest';
import { groupByModule, moduleLabel } from './role';

const permissions = [
  { code: 'access.users.create', description: 'Dar de alta', module: 'access' },
  { code: 'access.users.search', description: 'Listar', module: 'access' },
  { code: 'sales.invoices.create', description: 'Facturar', module: 'sales' },
];

describe('groupByModule', () => {
  it('groups the permissions of each module together', () => {
    const grouped = groupByModule(permissions);

    expect([...grouped.keys()]).toEqual(['access', 'sales']);
    expect(grouped.get('access')).toHaveLength(2);
  });

  it('returns nothing for an empty catalog', () => {
    expect(groupByModule([]).size).toBe(0);
  });
});

describe('moduleLabel', () => {
  it('names each module in Spanish', () => {
    expect(moduleLabel('access')).toBe('Acceso y administración');
    expect(moduleLabel('catalog')).toBe('Catálogo');
  });

  // Un modulo nuevo sin traducir se ve con su prefijo en vez de desaparecer.
  it('shows the raw prefix of a module it does not know yet', () => {
    expect(moduleLabel('payables')).toBe('payables');
  });
});
