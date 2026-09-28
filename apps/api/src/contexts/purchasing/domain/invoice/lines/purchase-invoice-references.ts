import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { PurchasingCatalog } from '../../catalog/purchasing-catalog.js';
import {
  EmptyPurchasingTextError,
  InactivePurchaseItemError,
  InvalidPurchaseCostError,
  InvalidPurchaseQuantityError,
  ItemNotPurchasableError,
  PurchaseItemNotFoundError,
} from '../../errors/purchasing.errors.js';
import { TaxRate, UnitCost } from '../../shared/money.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PurchaseInvoiceLine, PurchaseInvoiceLineId } from '../purchase-invoice-line.js';

export interface PurchaseInvoiceLineInput {
  id?: string;
  receiptLineId?: string | null;
  orderLineId?: string | null;
  itemId?: string | null;
  itemSku?: string | null;
  itemName?: string | null;
  concept?: string | null;
  unitId?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export class PurchaseInvoiceReferences {
  constructor(
    private readonly catalog: PurchasingCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async lines(tenantId: TenantId, inputs: PurchaseInvoiceLineInput[]): Promise<PurchaseInvoiceLine[]> {
    const itemIds = inputs
      .map((i) => i.itemId)
      .filter((id): id is string => Boolean(id))
      .map((id) => ItemRef.of(id));

    const catalogItems = itemIds.length > 0 ? await this.catalog.findItems(tenantId, itemIds) : [];
    const itemMap = new Map(catalogItems.map((item) => [item.id, item]));

    return inputs.map((input, index) => {
      const lineId = PurchaseInvoiceLineId.of(input.id ?? this.ids.next());
      const lineNumber = index + 1;

      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        throw new InvalidPurchaseQuantityError(input.quantity);
      }
      if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
        throw new InvalidPurchaseCostError(input.unitPrice);
      }

      let itemRef: ItemRef | null = null;
      let sku = input.itemSku ?? null;
      let name = input.itemName ?? input.concept ?? '';
      let defaultTaxRate = input.taxRate ?? 0;

      if (input.itemId) {
        itemRef = ItemRef.of(input.itemId);
        const item = itemMap.get(input.itemId);
        if (!item) {
          throw new PurchaseItemNotFoundError(input.itemId);
        }
        if (!item.isActive) {
          throw new InactivePurchaseItemError(input.itemId);
        }
        if (!item.isPurchasable) {
          throw new ItemNotPurchasableError(input.itemId);
        }
        sku = sku ?? item.sku;
        name = name || item.name;
        if (input.taxRate === undefined) {
          defaultTaxRate = item.taxRate;
        }
      }

      if (!name || name.trim().length === 0) {
        throw new EmptyPurchasingTextError('ItemName');
      }

      return PurchaseInvoiceLine.of({
        id: lineId,
        lineNumber,
        receiptLineId: input.receiptLineId ?? null,
        orderLineId: input.orderLineId ?? null,
        itemId: itemRef,
        itemSku: sku,
        itemName: name.trim(),
        concept: input.concept?.trim() ?? null,
        unitId: input.unitId ? UnitRef.of(input.unitId) : null,
        quantity: Quantity.of(input.quantity),
        unitPrice: UnitCost.of(input.unitPrice),
        taxRate: TaxRate.of(defaultTaxRate),
      });
    });
  }
}
