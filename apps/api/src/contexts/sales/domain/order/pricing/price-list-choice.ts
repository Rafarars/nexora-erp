import { SalesCatalog, SalesPriceList } from '../../catalog/sales-catalog.js';
import { InactivePriceListError, PriceListNotFoundError } from '../../errors/sales.errors.js';
import { PriceListRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';

// Con que lista se cotiza un pedido: la que eligio quien captura, la del cliente, o la que la
// empresa dejo por defecto. Es el orden del companero y el de los ERP, con la lista por defecto
// siempre al final como salvavidas.
export class PriceListChoice {
  constructor(private readonly catalog: SalesCatalog) {}

  async resolve(tenantId: TenantId, chosen: PriceListRef | null, customerList: PriceListRef | null): Promise<SalesPriceList | null> {
    for (const candidate of [chosen, customerList]) {
      if (!candidate) continue;

      const priceList = await this.catalog.findPriceList(tenantId, candidate);

      if (!priceList) throw new PriceListNotFoundError(candidate.value);
      // La del pedido la acaba de elegir una persona; la del cliente se le asigno antes y puede
      // haberse apagado despues, asi que ninguna de las dos se usa apagada.
      if (!priceList.isActive) throw new InactivePriceListError(candidate.value);

      return priceList;
    }

    return this.catalog.findDefaultPriceList(tenantId);
  }
}
