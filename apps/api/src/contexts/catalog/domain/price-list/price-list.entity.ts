import { DefaultPriceListDeactivationError, InactiveDefaultPriceListError } from '../errors/price-list.errors.js';
import { optionalText } from '../shared/bounded-text.vo.js';
import { CatalogCode, CodePrefix } from '../shared/catalog-code.vo.js';
import { CatalogRecord, CatalogRecordPrimitives } from '../shared/catalog-record.js';
import { CurrencyCode } from '../shared/currency-code.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { PriceListId } from './price-list-id.vo.js';
import { PriceListName } from './price-list-name.vo.js';

export interface PriceListPrimitives extends CatalogRecordPrimitives {
  name: string;
  description: string | null;
  currency: string;
  isDefault: boolean;
}

const DESCRIPTION_MAX = 1000;

// La lista solo nombra el conjunto y dice en que moneda esta: los precios cuelgan del articulo.
// Su moneda no cambia despues, porque cambiarla reinterpretaria todos sus precios de golpe.
export class PriceList extends CatalogRecord<PriceListId> {
  static readonly CODE_PREFIX: CodePrefix = 'LPR';

  private constructor(
    id: PriceListId,
    tenantId: TenantId,
    code: CatalogCode,
    private name: PriceListName,
    private description: string | null,
    readonly currency: CurrencyCode,
    private isDefaultList: boolean,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, tenantId, code, active, createdAt, updatedAt);
  }

  // Nace sin ser la lista por defecto: decidirlo exige mirar las demas, y eso lo hace
  // DefaultPriceList.
  static create(
    id: PriceListId,
    tenantId: TenantId,
    code: CatalogCode,
    name: PriceListName,
    description: string | null,
    currency: CurrencyCode,
    now: Date,
  ): PriceList {
    return new PriceList(
      id,
      tenantId,
      code,
      name,
      optionalText(description, DESCRIPTION_MAX, 'PriceListDescription'),
      currency,
      false,
      true,
      now,
      now,
    );
  }

  static fromPrimitives(row: PriceListPrimitives): PriceList {
    return new PriceList(
      PriceListId.of(row.id),
      TenantId.of(row.tenantId),
      CatalogCode.of(row.code),
      PriceListName.of(row.name),
      row.description,
      CurrencyCode.of(row.currency),
      row.isDefault,
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): PriceListPrimitives {
    return {
      ...this.recordPrimitives(),
      name: this.name.value,
      description: this.description,
      currency: this.currency.value,
      isDefault: this.isDefaultList,
    };
  }

  isDefault(): boolean {
    return this.isDefaultList;
  }

  update(name: PriceListName, description: string | null, now: Date): void {
    this.name = name;
    this.description = optionalText(description, DESCRIPTION_MAX, 'PriceListDescription');
    this.touch(now);
  }

  // Un cliente sin lista propia se cotiza con esta: si pudiera apagarse, se quedaria sin precio.
  override deactivate(now: Date): void {
    if (this.isDefaultList) throw new DefaultPriceListDeactivationError(this.id.value);

    super.deactivate(now);
  }

  markAsDefault(now: Date): void {
    if (!this.isActive()) throw new InactiveDefaultPriceListError(this.id.value);

    this.isDefaultList = true;
    this.touch(now);
  }

  unmarkAsDefault(now: Date): void {
    this.isDefaultList = false;
    this.touch(now);
  }
}
