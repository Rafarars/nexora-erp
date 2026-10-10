import { AccountResolutionFailedError } from '../errors/accounting.errors.js';

export interface ItemAccountConfig {
  inventoryAccountId?: string | null;
  cogsAccountId?: string | null;
  salesRevenueAccountId?: string | null;
  purchaseExpenseAccountId?: string | null;
}

export interface CategoryAccountConfig {
  inventoryAccountId?: string | null;
  cogsAccountId?: string | null;
  salesRevenueAccountId?: string | null;
  purchaseExpenseAccountId?: string | null;
}

export interface CompanyAccountConfig {
  inventoryAccountId?: string | null;
  cogsAccountId?: string | null;
  salesRevenueAccountId?: string | null;
  taxPayableAccountId?: string | null;
  receivablesAccountId?: string | null;
  payablesAccountId?: string | null;
  cashAccountId?: string | null;
  inventoryAdjustmentAccountId?: string | null;
  unappliedCreditNotesAccountId?: string | null;
  unappliedSupplierCreditNotesAccountId?: string | null;
  unbilledGoodsAccountId?: string | null;
  priceDifferenceAccountId?: string | null;
  purchaseExpenseAccountId?: string | null;
  pendingPriceDifferenceAccountId?: string | null;
  exchangeDifferenceAccountId?: string | null;
  openingEquityAccountId?: string | null;
}

export interface OperationalLineAccountContext {
  item?: ItemAccountConfig | null;
  category?: CategoryAccountConfig | null;
}

export type OperationalAccountPurpose =
  | 'inventory'
  | 'cogs'
  | 'salesRevenue'
  | 'purchaseExpense';

export type CompanyAccountPurpose =
  | 'taxPayable'
  | 'receivables'
  | 'payables'
  | 'cash'
  | 'inventoryAdjustment'
  | 'unappliedCreditNotes'
  | 'unappliedSupplierCreditNotes'
  | 'unbilledGoods'
  | 'priceDifference'
  | 'pendingPriceDifference'
  | 'exchangeDifference'
  | 'openingEquity';

const PURPOSE_LABELS: Record<OperationalAccountPurpose | CompanyAccountPurpose, string> = {
  inventory: 'Inventario',
  cogs: 'Costo de ventas',
  salesRevenue: 'Ingresos por ventas',
  purchaseExpense: 'Gasto de compras',
  taxPayable: 'Impuesto por pagar',
  receivables: 'Clientes por cobrar',
  payables: 'Proveedores por pagar',
  cash: 'Caja y banco',
  inventoryAdjustment: 'Ajuste de inventario',
  unappliedCreditNotes: 'Notas de crédito por aplicar',
  unappliedSupplierCreditNotes: 'Notas de crédito de proveedor por aplicar',
  unbilledGoods: 'Mercancía por facturar',
  priceDifference: 'Diferencia de precio de compra',
  pendingPriceDifference: 'Diferencia de precio pendiente',
  exchangeDifference: 'Diferencia en cambio',
  openingEquity: 'Patrimonio de apertura',
};

export class AccountResolver {
  /**
   * Resuelve una cuenta operativa evaluando la precedencia:
   * Artículo -> Categoría -> Empresa (§2.5).
   * Si ningún nivel la tiene configurada, lanza AccountResolutionFailedError.
   */
  static resolveOperational(
    purpose: OperationalAccountPurpose,
    context: OperationalLineAccountContext | undefined,
    company: CompanyAccountConfig,
  ): string {
    const key = this.purposeToKey(purpose);

    // 1. Artículo
    const itemAccount = context?.item?.[key];
    if (itemAccount && itemAccount.trim().length > 0) {
      return itemAccount;
    }

    // 2. Categoría
    const categoryAccount = context?.category?.[key];
    if (categoryAccount && categoryAccount.trim().length > 0) {
      return categoryAccount;
    }

    // 3. Empresa
    const companyAccount = company[key];
    if (companyAccount && companyAccount.trim().length > 0) {
      return companyAccount;
    }

    throw new AccountResolutionFailedError(PURPOSE_LABELS[purpose]);
  }

  /**
   * Resuelve una de las doce cuentas directas de la empresa (§2.5).
   * Si falta en la configuración de la empresa, lanza AccountResolutionFailedError.
   */
  static resolveCompany(
    purpose: CompanyAccountPurpose,
    company: CompanyAccountConfig,
  ): string {
    const key = this.companyPurposeToKey(purpose);
    const accountId = company[key];

    if (accountId && accountId.trim().length > 0) {
      return accountId;
    }

    throw new AccountResolutionFailedError(PURPOSE_LABELS[purpose]);
  }

  private static purposeToKey(
    purpose: OperationalAccountPurpose,
  ): 'inventoryAccountId' | 'cogsAccountId' | 'salesRevenueAccountId' | 'purchaseExpenseAccountId' {
    switch (purpose) {
      case 'inventory':
        return 'inventoryAccountId';
      case 'cogs':
        return 'cogsAccountId';
      case 'salesRevenue':
        return 'salesRevenueAccountId';
      case 'purchaseExpense':
        return 'purchaseExpenseAccountId';
    }
  }

  private static companyPurposeToKey(
    purpose: CompanyAccountPurpose,
  ): keyof CompanyAccountConfig {
    switch (purpose) {
      case 'taxPayable':
        return 'taxPayableAccountId';
      case 'receivables':
        return 'receivablesAccountId';
      case 'payables':
        return 'payablesAccountId';
      case 'cash':
        return 'cashAccountId';
      case 'inventoryAdjustment':
        return 'inventoryAdjustmentAccountId';
      case 'unappliedCreditNotes':
        return 'unappliedCreditNotesAccountId';
      case 'unappliedSupplierCreditNotes':
        return 'unappliedSupplierCreditNotesAccountId';
      case 'unbilledGoods':
        return 'unbilledGoodsAccountId';
      case 'priceDifference':
        return 'priceDifferenceAccountId';
      case 'pendingPriceDifference':
        return 'pendingPriceDifferenceAccountId';
      case 'exchangeDifference':
        return 'exchangeDifferenceAccountId';
      case 'openingEquity':
        return 'openingEquityAccountId';
    }
  }
}
