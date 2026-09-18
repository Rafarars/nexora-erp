import { PriceListNotFoundError } from '../../errors/price-list.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PriceListId } from '../price-list-id.vo.js';
import { PriceList } from '../price-list.entity.js';
import { PriceListRepository } from '../price-list.repository.js';

export class PriceListFinder {
  constructor(private readonly priceLists: PriceListRepository) {}

  async find(tenantId: TenantId, id: PriceListId): Promise<PriceList> {
    const priceList = await this.priceLists.find(tenantId, id);

    if (!priceList) throw new PriceListNotFoundError(id.value);

    return priceList;
  }
}
