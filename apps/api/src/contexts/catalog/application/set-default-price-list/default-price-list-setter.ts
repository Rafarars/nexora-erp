import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DefaultPriceList } from '../../domain/price-list/default/default-price-list.js';
import { PriceListFinder } from '../../domain/price-list/find/price-list-finder.js';
import { PriceListId } from '../../domain/price-list/price-list-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface DefaultPriceListSetterRequest {
  tenantId: string;
  priceListId: string;
}

export class DefaultPriceListSetter {
  constructor(
    private readonly finder: PriceListFinder,
    private readonly defaults: DefaultPriceList,
    private readonly clock: Clock,
  ) {}

  async run(request: DefaultPriceListSetterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const priceList = await this.finder.find(tenantId, PriceListId.of(request.priceListId));

    await this.defaults.assign(tenantId, priceList, this.clock.now());
  }
}
