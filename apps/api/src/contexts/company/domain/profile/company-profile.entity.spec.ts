import { describe, expect, it } from 'vitest';
import { CompanyTextTooLongError, InvalidCompanyEmailError, RequiredCompanyTextError } from '../errors/company.errors.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { LATER, TENANT_A } from '../testing/company.mother.js';
import { CompanyProfile } from './company-profile.entity.js';

const blank = () => CompanyProfile.blank(TenantId.of(TENANT_A), 'Acme Industrial');

describe('CompanyProfile', () => {
  it('stores empty optional data as null', () => {
    const profile = blank();
    profile.update({ legalName: 'Acme', tradeName: '  ', email: '' }, LATER);

    expect(profile.toPrimitives()).toMatchObject({ legalName: 'Acme', tradeName: null, email: null, updatedAt: LATER });
  });

  it('needs a legal name', () => {
    expect(() => blank().update({ legalName: '   ' }, LATER)).toThrow(RequiredCompanyTextError);
  });

  it('rejects an email that is not one', () => {
    expect(() => blank().update({ legalName: 'Acme', email: 'administracion' }, LATER)).toThrow(InvalidCompanyEmailError);
  });

  it('rejects a fiscal id longer than its column', () => {
    expect(() => blank().update({ legalName: 'Acme', fiscalId: 'J'.repeat(31) }, LATER)).toThrow(CompanyTextTooLongError);
  });
});
