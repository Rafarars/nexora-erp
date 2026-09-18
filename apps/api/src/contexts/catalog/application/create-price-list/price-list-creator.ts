import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { DefaultPriceList } from '../../domain/price-list/default/default-price-list.js';
import { PriceListId } from '../../domain/price-list/price-list-id.vo.js';
import { PriceListName } from '../../domain/price-list/price-list-name.vo.js';
import { PriceList } from '../../domain/price-list/price-list.entity.js';
import { PriceListUniqueness } from '../../domain/price-list/unique/price-list-uniqueness.js';
import { CatalogCode } from '../../domain/shared/catalog-code.vo.js';
import { CodeSequence } from '../../domain/shared/code-sequence.js';
import { CurrencyCode } from '../../domain/shared/currency-code.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { UsablePriceListCurrency } from '../../domain/price-list/currency/usable-price-list-currency.js';

export interface PriceListCreatorRequest {
  tenantId: string;
  name: string;
  description?: string | null;
  currency: string;
}

export class PriceListCreator {
  constructor(
    private readonly defaults: DefaultPriceList,
    private readonly uniqueness: PriceListUniqueness,
    private readonly currencies: UsablePriceListCurrency,
    private readonly codes: CodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: PriceListCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const name = PriceListName.of(request.name);
    const currency = CurrencyCode.of(request.currency);

    await this.uniqueness.ensureNameIsFree(tenantId, name);
    await this.currencies.ensureUsable(currency);

    const code = CatalogCode.fromSequence(PriceList.CODE_PREFIX, await this.codes.next(tenantId, PriceList.CODE_PREFIX));
    const now = this.clock.now();

    await this.defaults.register(
      PriceList.create(PriceListId.of(this.ids.next()), tenantId, code, name, request.description ?? null, currency, now),
      now,
    );
  }
}
