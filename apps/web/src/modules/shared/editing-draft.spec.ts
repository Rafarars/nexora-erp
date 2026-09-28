import { describe, expect, it } from 'vitest';
import {
  computeDraftFingerprint,
  editingDraftKey,
  resolveEditingDraft,
} from './editing-draft';

describe('resolveEditingDraft', () => {
  it('returns null when no id is being edited', () => {
    const items = [{ id: '1', name: 'Item 1' }];
    expect(resolveEditingDraft(items, null, null)).toBeNull();
  });

  it('returns the updated record from fresh props when present', () => {
    const staleSnapshot = { id: '1', reason: 'Motivo viejo', amount: 10 };
    const freshFromProps = { id: '1', reason: 'Motivo guardado', amount: 20 };
    const items = [freshFromProps];

    const resolved = resolveEditingDraft(items, '1', staleSnapshot);
    expect(resolved).toBe(freshFromProps);
    expect(resolved?.reason).toBe('Motivo guardado');
    expect(resolved?.amount).toBe(20);
  });

  it('falls back to snapshot copy when record disappears from current props', () => {
    const staleSnapshot = { id: '1', reason: 'Motivo preservado', amount: 10 };
    // El registro no esta en la pagina o filtro actual
    const items = [{ id: '2', reason: 'Otro', amount: 5 }];

    const resolved = resolveEditingDraft(items, '1', staleSnapshot);
    expect(resolved).toBe(staleSnapshot);
    expect(resolved?.reason).toBe('Motivo preservado');
  });

  it('supports custom id extractor for entities like Person with userId', () => {
    const staleSnapshot = { userId: 'u-1', name: 'Viejo' };
    const freshFromProps = { userId: 'u-1', name: 'Nuevo' };
    const items = [freshFromProps];

    const resolved = resolveEditingDraft(items, 'u-1', staleSnapshot, (p) => p.userId);
    expect(resolved).toBe(freshFromProps);
    expect(resolved?.name).toBe('Nuevo');
  });
});

describe('computeDraftFingerprint', () => {
  it('returns empty string for null or undefined', () => {
    expect(computeDraftFingerprint(null)).toBe('');
    expect(computeDraftFingerprint(undefined)).toBe('');
  });

  it('produces the exact same fingerprint for identical data', () => {
    const draftA = { id: '1', reason: 'Ajuste', lines: [{ qty: 2, price: 10 }] };
    const draftB = { id: '1', reason: 'Ajuste', lines: [{ qty: 2, price: 10 }] };

    expect(computeDraftFingerprint(draftA)).toBe(computeDraftFingerprint(draftB));
  });

  it('produces the same fingerprint regardless of object key order', () => {
    const draft1 = { id: '1', reason: 'Ajuste', status: 'draft' };
    const draft2 = { status: 'draft', id: '1', reason: 'Ajuste' };

    expect(computeDraftFingerprint(draft1)).toBe(computeDraftFingerprint(draft2));
  });

  it('produces a different fingerprint when an editable field changes', () => {
    const original = { id: '1', reason: 'Motivo 1', amount: 100 };
    const modifiedReason = { id: '1', reason: 'Motivo 2', amount: 100 };
    const modifiedAmount = { id: '1', reason: 'Motivo 1', amount: 150 };

    const hashOrig = computeDraftFingerprint(original);
    const hashModReason = computeDraftFingerprint(modifiedReason);
    const hashModAmount = computeDraftFingerprint(modifiedAmount);

    expect(hashModReason).not.toBe(hashOrig);
    expect(hashModAmount).not.toBe(hashOrig);
  });

  it('produces a different fingerprint when nested array items change', () => {
    const original = { id: '1', lines: [{ itemId: 'item-1', qty: 2 }] };
    const modifiedQty = { id: '1', lines: [{ itemId: 'item-1', qty: 3 }] };

    expect(computeDraftFingerprint(modifiedQty)).not.toBe(computeDraftFingerprint(original));
  });

  it('is completely deterministic and produces identical results across repeated invocations', () => {
    const draft = { id: '1', reason: 'Constante', notes: 'Fijas' };
    const firstRun = computeDraftFingerprint(draft);

    for (let i = 0; i < 50; i++) {
      expect(computeDraftFingerprint(draft)).toBe(firstRun);
    }
  });
});

describe('editingDraftKey', () => {
  it('returns prefix-new when item is null', () => {
    expect(editingDraftKey('form', null)).toBe('form-new');
    expect(editingDraftKey('reason', null)).toBe('reason-new');
  });

  it('includes id and fingerprint when item is present', () => {
    const item = { id: 'ret-123', reason: 'Prueba' };
    const key = editingDraftKey('form', item);

    expect(key).toContain('form-ret-123-');
    expect(key).toBe(`form-ret-123-${computeDraftFingerprint(item)}`);
  });

  it('changes key when item data updates so React remounts uncontrolled inputs', () => {
    const initial = { id: 'ret-123', reason: 'Motivo inicial' };
    const edited = { id: 'ret-123', reason: 'Motivo editado' };

    const keyInitial = editingDraftKey('form', initial);
    const keyEdited = editingDraftKey('form', edited);

    expect(keyInitial).not.toBe(keyEdited);
  });
});
