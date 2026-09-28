import { describe, expect, it } from 'vitest';
import { payablesCode } from './code-sequence.js';
import { InMemoryPayablesCodeSequence } from '../../infrastructure/testing/in-memory-payables-code-sequence.js';
import { TenantId } from './tenant-id.vo.js';

describe('payablesCode', () => {
  it('formats PAG with 6 digits', () => {
    expect(payablesCode('PAG', 1)).toBe('PAG000001');
    expect(payablesCode('PAG', 42)).toBe('PAG000042');
  });

  it('formats NCP with 6 digits', () => {
    expect(payablesCode('NCP', 5)).toBe('NCP000005');
  });

  it('increments in-memory code sequence per tenant and prefix', async () => {
    const sequence = new InMemoryPayablesCodeSequence();
    const t1 = TenantId.of('a0000000-0000-4000-8000-000000000001');
    const t2 = TenantId.of('a0000000-0000-4000-8000-000000000002');

    expect(await sequence.next(t1, 'PAG')).toBe(1);
    expect(await sequence.next(t1, 'PAG')).toBe(2);
    expect(await sequence.next(t1, 'NCP')).toBe(1);
    expect(await sequence.next(t2, 'PAG')).toBe(1);
  });
});
