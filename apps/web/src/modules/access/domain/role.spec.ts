import { describe, expect, it } from 'vitest';
import { groupByModule } from './role';

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
