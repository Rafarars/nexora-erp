import { describe, expect, it } from 'vitest';
import { Email, InvalidEmailError } from './email.vo.js';

describe('Email', () => {
  it('accepts a well formed address', () => {
    expect(Email.of('ana@acme.com').value).toBe('ana@acme.com');
  });

  it('normalizes case and surrounding spaces', () => {
    expect(Email.of('  Ana@ACME.com  ').value).toBe('ana@acme.com');
  });

  it.each(['ana', 'ana@', '@acme.com', 'ana@acme', 'ana acme@x.com', 'ana@@acme.com'])(
    'rejects <%s>',
    (candidate) => {
      expect(() => Email.of(candidate)).toThrow(InvalidEmailError);
    },
  );

  it('rejects an empty value', () => {
    expect(() => Email.of('   ')).toThrow(/cannot be empty/);
  });

  it('considers two addresses equal ignoring case', () => {
    expect(Email.of('Ana@Acme.com').equals(Email.of('ana@acme.com'))).toBe(true);
  });
});
