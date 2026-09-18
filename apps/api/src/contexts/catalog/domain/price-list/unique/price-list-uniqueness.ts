import { DuplicatePriceListNameError } from '../../errors/price-list.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PriceListId } from '../price-list-id.vo.js';
import { PriceListName } from '../price-list-name.vo.js';
import { PriceListRepository } from '../price-list.repository.js';

export class PriceListUniqueness {
  constructor(private readonly priceLists: PriceListRepository) {}

  // `except` es la lista que se esta editando: conservar su propio nombre no choca.
  async ensureNameIsFree(tenantId: TenantId, name: PriceListName, except?: PriceListId): Promise<void> {
    const existing = await this.priceLists.findByName(tenantId, name);

    if (existing && !(except && existing.id.equals(except))) {
      throw new DuplicatePriceListNameError(name.value, tenantId.value);
    }
  }
}
