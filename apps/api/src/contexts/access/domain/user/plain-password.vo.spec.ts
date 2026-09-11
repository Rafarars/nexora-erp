import { describe, expect, it } from 'vitest';
import { PlainPassword, WeakPasswordError } from './plain-password.vo.js';

describe('PlainPassword', () => {
  it('accepts a password long enough', () => {
    expect(PlainPassword.of('a-long-enough-password').value).toBe('a-long-enough-password');
  });

  it('accepts exactly the minimum length', () => {
    expect(PlainPassword.of('12345678').value).toHaveLength(8);
  });

  it('rejects one character below the minimum', () => {
    expect(() => PlainPassword.of('1234567')).toThrow(WeakPasswordError);
  });

  it('rejects an empty password', () => {
    expect(() => PlainPassword.of('   ')).toThrow();
  });
});
