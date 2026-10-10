import { describe, expect, it } from 'vitest';
import { AccountResolutionFailedError } from '../errors/accounting.errors.js';
import { AccountResolver, CompanyAccountConfig } from './account-resolver.js';

describe('AccountResolver (§2.5 Precedencia de determinación de cuentas)', () => {
  const companyAccounts: CompanyAccountConfig = {
    inventoryAccountId: 'company-inv',
    cogsAccountId: 'company-cogs',
    salesRevenueAccountId: 'company-sales',
    taxPayableAccountId: 'company-tax',
    receivablesAccountId: 'company-receivables',
    payablesAccountId: 'company-payables',
    cashAccountId: 'company-cash',
    inventoryAdjustmentAccountId: 'company-adjustment',
    unappliedCreditNotesAccountId: 'company-unapplied-cn',
    unappliedSupplierCreditNotesAccountId: 'company-unapplied-scn',
    unbilledGoodsAccountId: 'company-unbilled-goods',
    priceDifferenceAccountId: 'company-price-diff',
    purchaseExpenseAccountId: 'company-purchase-expense',
    pendingPriceDifferenceAccountId: 'company-pending-price-diff',
    exchangeDifferenceAccountId: 'company-exchange-diff',
    openingEquityAccountId: 'company-opening-equity',
  };

  it('resolves operational account from item when item overrides category and company', () => {
    const resolved = AccountResolver.resolveOperational(
      'inventory',
      {
        item: { inventoryAccountId: 'item-inv' },
        category: { inventoryAccountId: 'category-inv' },
      },
      companyAccounts,
    );

    expect(resolved).toBe('item-inv');
  });

  it('resolves operational account from category when item does not configure it', () => {
    const resolved = AccountResolver.resolveOperational(
      'cogs',
      {
        item: { cogsAccountId: null },
        category: { cogsAccountId: 'category-cogs' },
      },
      companyAccounts,
    );

    expect(resolved).toBe('category-cogs');
  });

  it('falls back to company when neither item nor category configure operational account', () => {
    const resolved = AccountResolver.resolveOperational(
      'salesRevenue',
      {
        item: null,
        category: { salesRevenueAccountId: null },
      },
      companyAccounts,
    );

    expect(resolved).toBe('company-sales');
  });

  it('rejects operational resolution if no level configures the account', () => {
    const emptyCompany: CompanyAccountConfig = { ...companyAccounts, inventoryAccountId: null };

    expect(() =>
      AccountResolver.resolveOperational(
        'inventory',
        { item: null, category: null },
        emptyCompany,
      ),
    ).toThrow(AccountResolutionFailedError);
  });

  it('resolves direct company accounts accurately', () => {
    expect(AccountResolver.resolveCompany('unbilledGoods', companyAccounts)).toBe('company-unbilled-goods');
    expect(AccountResolver.resolveCompany('receivables', companyAccounts)).toBe('company-receivables');
    expect(AccountResolver.resolveCompany('payables', companyAccounts)).toBe('company-payables');
    expect(AccountResolver.resolveCompany('openingEquity', companyAccounts)).toBe('company-opening-equity');
    expect(AccountResolver.resolveCompany('exchangeDifference', companyAccounts)).toBe('company-exchange-diff');
  });

  it('rejects direct company account resolution when missing in company settings', () => {
    const missingOpeningEquity: CompanyAccountConfig = {
      ...companyAccounts,
      openingEquityAccountId: null,
    };

    expect(() =>
      AccountResolver.resolveCompany('openingEquity', missingOpeningEquity),
    ).toThrow(AccountResolutionFailedError);
  });
});
