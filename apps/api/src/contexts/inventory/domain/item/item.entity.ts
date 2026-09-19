import { optionalText } from '../shared/bounded-text.vo.js';
import { CategoryRef, TaxRef, UnitRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { ItemCode } from './item-code.vo.js';
import { ItemId } from './item-id.vo.js';
import { Barcode } from './barcode.vo.js';
import { ItemName } from './item-name.vo.js';
import { PriceBelowMinimumError } from '../errors/item.errors.js';
import { ItemPricePrimitives, ItemPrices } from './item-prices.js';
import { ItemReorderRulePrimitives, ItemReorderRules } from './item-reorder-rules.js';
import { SalePrice } from './sale-price.vo.js';
import { ItemUnitPrimitives, ItemUnits } from './item-units.js';
import { ItemType } from './item-type.js';
import { Sku } from './sku.vo.js';

export interface ItemPrimitives {
  id: string;
  tenantId: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  type: ItemType;
  // Un articulo puede existir solo para comprar (un insumo) o solo para vender.
  isPurchasable: boolean;
  isSellable: boolean;
  categoryId: string | null;
  // Un articulo puede comprarse exento y venderse con IVA: son dos impuestos distintos.
  salesTaxId: string | null;
  purchaseTaxId: string | null;
  units: ItemUnitPrimitives[];
  reorderRules: ItemReorderRulePrimitives[];
  prices: ItemPricePrimitives[];
  // Piso de venta, en la moneda de la empresa. Sin el, cualquier precio vale.
  minPrice: number | null;
}

// Lo que una persona decide de un articulo, igual al crearlo y al editarlo.
export interface ItemDetails {
  sku: Sku;
  barcode: Barcode | null;
  name: ItemName;
  description: string | null;
  type: ItemType;
  isPurchasable: boolean;
  isSellable: boolean;
  categoryId: CategoryRef | null;
  salesTaxId: TaxRef | null;
  purchaseTaxId: TaxRef | null;
  units: ItemUnits;
  reorderRules: ItemReorderRules;
  prices: ItemPrices;
  minPrice: SalePrice | null;
}

const DESCRIPTION_MAX = 1000;

// El maestro del articulo. Nada lo borra: se desactiva y se reactiva.
export class Item {
  private constructor(
    readonly id: ItemId,
    readonly tenantId: TenantId,
    readonly code: ItemCode,
    private details: ItemDetails,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(id: ItemId, tenantId: TenantId, code: ItemCode, details: ItemDetails, now: Date): Item {
    return new Item(id, tenantId, code, normalized(details), true, now, now);
  }

  static fromPrimitives(row: ItemPrimitives): Item {
    return new Item(
      ItemId.of(row.id),
      TenantId.of(row.tenantId),
      ItemCode.of(row.code),
      {
        sku: Sku.of(row.sku),
        name: ItemName.of(row.name),
        description: row.description,
        type: row.type,
        categoryId: row.categoryId ? CategoryRef.of(row.categoryId) : null,
        barcode: row.barcode ? Barcode.of(row.barcode) : null,
        isPurchasable: row.isPurchasable,
        isSellable: row.isSellable,
        salesTaxId: row.salesTaxId ? TaxRef.of(row.salesTaxId) : null,
        purchaseTaxId: row.purchaseTaxId ? TaxRef.of(row.purchaseTaxId) : null,
        units: ItemUnits.fromPrimitives(row.units),
        reorderRules: ItemReorderRules.fromPrimitives(row.reorderRules),
        prices: ItemPrices.fromPrimitives(row.prices),
        minPrice: row.minPrice === null ? null : SalePrice.of(row.minPrice),
      },
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): ItemPrimitives {
    const { sku, barcode, name, description, type, isPurchasable, isSellable, categoryId, salesTaxId, purchaseTaxId, units, reorderRules, prices, minPrice } =
      this.details;

    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code.value,
      isActive: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      sku: sku.value,
      name: name.value,
      description,
      type,
      categoryId: categoryId?.value ?? null,
      barcode: barcode?.value ?? null,
      isPurchasable,
      isSellable,
      salesTaxId: salesTaxId?.value ?? null,
      purchaseTaxId: purchaseTaxId?.value ?? null,
      units: units.toPrimitives(),
      reorderRules: reorderRules.toPrimitives(),
      prices: prices.toPrimitives(),
      minPrice: minPrice?.toNumber() ?? null,
    };
  }

  isActive(): boolean {
    return this.active;
  }

  deactivate(now: Date): void {
    this.active = false;
    this.updatedAt = now;
  }

  activate(now: Date): void {
    this.active = true;
    this.updatedAt = now;
  }

  update(details: ItemDetails, now: Date): void {
    this.details = normalized(details);
    this.updatedAt = now;
  }

  // Lo que el kardex no tolera que cambie: la unidad en la que guarda las cantidades y si el
  // articulo tiene existencia o no.
  changesStockIdentity(details: ItemDetails): boolean {
    return (
      details.type !== this.details.type || !details.units.base().unitId.equals(this.details.units.base().unitId)
    );
  }

  // Cierto si el articulo deja de ofrecerse por ese lado. Volver a ofrecerlo no estorba a nadie.
  stopsBeingPurchasable(details: ItemDetails): boolean {
    return this.details.isPurchasable && !details.isPurchasable;
  }

  stopsBeingSellable(details: ItemDetails): boolean {
    return this.details.isSellable && !details.isSellable;
  }

  // Cierto si con los datos nuevos la unidad sigue en el articulo y con el mismo factor.
  keepsUnit(details: ItemDetails, unitId: UnitRef): boolean {
    const current = this.details.units.factorOf(unitId);

    return current !== null && details.units.factorOf(unitId) === current;
  }

  sku(): Sku {
    return this.details.sku;
  }

  reorderRules(): ItemReorderRules {
    return this.details.reorderRules;
  }

  prices(): ItemPrices {
    return this.details.prices;
  }

  minPrice(): SalePrice | null {
    return this.details.minPrice;
  }

  barcode(): Barcode | null {
    return this.details.barcode;
  }

  categoryId(): CategoryRef | null {
    return this.details.categoryId;
  }

  salesTaxId(): TaxRef | null {
    return this.details.salesTaxId;
  }

  purchaseTaxId(): TaxRef | null {
    return this.details.purchaseTaxId;
  }

  // Los impuestos que referencia, sin repetir: el de venta, el de compra, o el mismo en los dos.
  taxIds(): TaxRef[] {
    const ids = [this.details.salesTaxId, this.details.purchaseTaxId].filter((id): id is TaxRef => id !== null);

    return ids.filter((id, index) => ids.findIndex((candidate) => candidate.equals(id)) === index);
  }

  unitIds(): UnitRef[] {
    return this.details.units.unitIds();
  }

  usesCategory(id: CategoryRef): boolean {
    return this.details.categoryId?.equals(id) ?? false;
  }

  usesTax(id: TaxRef): boolean {
    return this.taxIds().some((taxId) => taxId.equals(id));
  }

  usesUnit(id: UnitRef): boolean {
    return this.details.units.uses(id);
  }
}

function normalized(details: ItemDetails): ItemDetails {
  ensurePricesReachTheMinimum(details);

  return { ...details, description: optionalText(details.description, DESCRIPTION_MAX, 'ItemDescription') };
}

// El minimo es el piso del articulo: cargar una lista por debajo dejaria un precio sugerido que la
// linea del pedido rechazaria despues.
function ensurePricesReachTheMinimum({ prices, minPrice }: ItemDetails): void {
  if (!minPrice) return;

  for (const price of prices.all()) {
    if (price.price.isLowerThan(minPrice)) {
      throw new PriceBelowMinimumError(price.price.toNumber(), minPrice.toNumber());
    }
  }
}
