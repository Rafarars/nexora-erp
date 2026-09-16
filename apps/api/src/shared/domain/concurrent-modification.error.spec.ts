import { describe, expect, it } from 'vitest';
import { ConcurrentModificationError } from './concurrent-modification.error.js';
import { ConflictError } from './domain.error.js';

describe('ConcurrentModificationError', () => {
  it('belongs to ConflictError category', () => {
    expect(new ConcurrentModificationError('123')).toBeInstanceOf(ConflictError);
  });

  it('hides internal identifier in public message', () => {
    const error = new ConcurrentModificationError('secret-id');
    expect(error.publicMessage).not.toContain('secret-id');
  });
});
