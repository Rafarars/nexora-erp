export type CostedLine = {
  itemId: string;
  quantity: number;
  unitCost: number;
  amount?: number;
  label?: string;
};

export type AdjustedStockLine = CostedLine & {
  direction: 'in' | 'out';
};

export type PricedLine = {
  itemId: string | null;
  concept?: string;
  subtotal: number;
  tax: number;
  label?: string;
};

export type ReturnedLine = CostedLine & {
  restoresMovementId: string | null;
};

export type PaymentAllocation = {
  invoiceId: string;
  amount: number;
  exchangeDifference: number;
};

export type PurchasePricing = {
  baseCost: number;
  priceDifference: number;
  exchangeDifference: number;
  serviceLines: PricedLine[];
  tax: number;
  total: number;
};

export type RevaluationSplit = {
  stockPart: number;
  soldPart: number;
};

export type AccountingEvent =
  | {
      kind: 'goods-received';
      documentId: string;
      date: Date | string;
      currency?: string;
      lines: CostedLine[];
    }
  | {
      kind: 'goods-dispatched';
      documentId: string;
      date: Date | string;
      currency?: string;
      lines: CostedLine[];
    }
  | {
      kind: 'sales-invoice-issued';
      documentId: string;
      date: Date | string;
      customerId: string;
      currency?: string;
      lines: PricedLine[];
      tax: number;
      total: number;
    }
  | {
      kind: 'purchase-invoice-confirmed';
      documentId: string;
      date: Date | string;
      supplierId: string;
      currency?: string;
      pricing: PurchasePricing;
    }
  | {
      kind: 'payment-received';
      documentId: string;
      date: Date | string;
      method?: string;
      amount: number;
      allocatedAmount: number;
      exchangeDifference: number;
      currency?: string;
      allocations: PaymentAllocation[];
      creditSourceId?: string | null;
    }
  | {
      kind: 'payment-made';
      documentId: string;
      date: Date | string;
      method?: string;
      amount: number;
      allocatedAmount: number;
      exchangeDifference: number;
      currency?: string;
      allocations: PaymentAllocation[];
      creditSourceId?: string | null;
    }
  | {
      kind: 'customer-credit-note-issued';
      documentId: string;
      date: Date | string;
      customerId: string;
      currency?: string;
      lines: PricedLine[];
      tax: number;
      total: number;
    }
  | {
      kind: 'supplier-credit-note-issued';
      documentId: string;
      date: Date | string;
      supplierId: string;
      currency?: string;
      pricing: PurchasePricing;
      creditsReturn: { returnId: string; returnedCost: number } | null;
    }
  | {
      kind: 'goods-returned';
      documentId: string;
      date: Date | string;
      side: 'customer' | 'supplier';
      currency?: string;
      lines: ReturnedLine[];
    }
  | {
      kind: 'stock-adjusted';
      documentId: string;
      date: Date | string;
      reason: string;
      origin: 'manual';
      direction: 'in' | 'out';
      currency?: string;
      lines: AdjustedStockLine[];
    }
  | {
      kind: 'purchase-price-revalued';
      documentId: string;
      date: Date | string;
      currency?: string;
      lines: { itemId: string; split: RevaluationSplit }[];
    }
  | {
      kind: 'opening-balance';
      documentId: string;
      date: Date | string;
      currency?: string;
      inventoryTotal: number;
      receivablesTotal: number;
      payablesTotal: number;
      equityTotal: number;
    }
  | {
      kind: 'document-cancelled';
      originType: string;
      originId: string;
      date: Date | string;
    };
