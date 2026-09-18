import { TenantId } from '../../shared/tenant-id.vo.js';
import { PriceList } from '../price-list.entity.js';
import { PriceListRepository } from '../price-list.repository.js';

// Una empresa tiene exactamente una lista por defecto en cuanto tiene alguna: la primera lo es
// sola, y elegir otra le quita la marca a la anterior en la misma escritura. Es la lista con la
// que se cotiza a un cliente que no tiene la suya.
export class DefaultPriceList {
  constructor(private readonly priceLists: PriceListRepository) {}

  async register(priceList: PriceList, now: Date): Promise<void> {
    if (!(await this.priceLists.findDefault(priceList.tenantId))) {
      priceList.markAsDefault(now);
    }

    await this.priceLists.save(priceList);
  }

  async assign(tenantId: TenantId, priceList: PriceList, now: Date): Promise<void> {
    const current = await this.priceLists.findDefault(tenantId);

    if (current?.id.equals(priceList.id)) return;

    priceList.markAsDefault(now);
    current?.unmarkAsDefault(now);

    await this.priceLists.saveAll(current ? [current, priceList] : [priceList]);
  }
}
