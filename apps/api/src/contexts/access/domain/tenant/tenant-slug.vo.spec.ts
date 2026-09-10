import { describe, expect, it } from 'vitest';
import { InvalidTenantSlugError, TenantSlug } from './tenant-slug.vo.js';

describe('TenantSlug', () => {
  it('accepts lowercase words joined by hyphens', () => {
    expect(TenantSlug.of('acme-corp').value).toBe('acme-corp');
  });

  it('lowercases what it receives', () => {
    expect(TenantSlug.of('ACME').value).toBe('acme');
  });

  it.each(['acme corp', 'acme_corp', '-acme', 'acme-', 'acmé', 'acme--corp'])(
    'rejects <%s>',
    (candidate) => {
      expect(() => TenantSlug.of(candidate)).toThrow(InvalidTenantSlugError);
    },
  );
});
