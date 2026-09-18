import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PriceListFinder } from '../../domain/price-list/find/price-list-finder.js';
import { PriceListId } from '../../domain/price-list/price-list-id.vo.js';
import { PriceListRepository } from '../../domain/price-list/price-list.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PriceListStatusChangerRequest {
  tenantId: string;
  priceListId: string;
  active: boolean;
}

// Que la lista por defecto no se desactive lo decide la propia entidad. Una lista apagada deja de
// sugerir precios, pero los documentos que ya la usaron conservan los suyos.
export class PriceListStatusChanger {
  constructor(
    private readonly finder: PriceListFinder,
    private readonly priceLists: PriceListRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: PriceListStatusChangerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const priceList = await this.finder.find(tenantId, PriceListId.of(request.priceListId));

    if (request.active) {
      priceList.activate(this.clock.now());
    } else {
      priceList.deactivate(this.clock.now());
    }

    await this.priceLists.save(priceList);
  }
}
