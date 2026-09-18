import { PriceListRepository } from '../../domain/price-list/price-list.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PriceListResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface PriceListSearcherResponse {
  priceLists: PriceListResponse[];
}

export class PriceListSearcher {
  constructor(private readonly priceLists: PriceListRepository) {}

  async run(request: { tenantId: string }): Promise<PriceListSearcherResponse> {
    const priceLists = await this.priceLists.searchByTenant(TenantId.of(request.tenantId));

    return {
      priceLists: priceLists
        .map((priceList) => {
          const { id, code, name, description, currency, isDefault, isActive } = priceList.toPrimitives();

          return { id, code, name, description, currency, isDefault, isActive };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }
}
