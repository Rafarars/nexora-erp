import { describe, expect, it } from 'vitest';
import { PasswordHash, PlainPasswordError } from './password-hash.vo.js';
import { VALID_HASH } from '../testing/access.mother.js';

describe('PasswordHash', () => {
  it('accepts a hashed value', () => {
    expect(PasswordHash.of(VALID_HASH).value).toBe(VALID_HASH);
  });

  it('rejects a plain password', () => {
    expect(() => PasswordHash.of('hunter2')).toThrow(PlainPasswordError);
  });

  it('rejects a value that looks hashed but is too short', () => {
    expect(() => PasswordHash.of('$short')).toThrow(PlainPasswordError);
  });
});
