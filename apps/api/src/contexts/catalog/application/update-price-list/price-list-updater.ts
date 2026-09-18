import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PriceListFinder } from '../../domain/price-list/find/price-list-finder.js';
import { PriceListId } from '../../domain/price-list/price-list-id.vo.js';
import { PriceListName } from '../../domain/price-list/price-list-name.vo.js';
import { PriceListRepository } from '../../domain/price-list/price-list.repository.js';
import { PriceListUniqueness } from '../../domain/price-list/unique/price-list-uniqueness.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PriceListUpdaterRequest {
  tenantId: string;
  priceListId: string;
  name: string;
  description?: string | null;
}

// La moneda no se edita: cambiarla reinterpretaria de golpe todos los precios ya cargados.
export class PriceListUpdater {
  constructor(
    private readonly finder: PriceListFinder,
    private readonly uniqueness: PriceListUniqueness,
    private readonly priceLists: PriceListRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: PriceListUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const priceList = await this.finder.find(tenantId, PriceListId.of(request.priceListId));
    const name = PriceListName.of(request.name);

    await this.uniqueness.ensureNameIsFree(tenantId, name, priceList.id);

    priceList.update(name, request.description ?? null, this.clock.now());

    await this.priceLists.save(priceList);
  }
}
