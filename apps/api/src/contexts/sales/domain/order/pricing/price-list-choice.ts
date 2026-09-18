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
    // La del pedido la acaba de elegir una persona: si no sirve, se le dice.
    if (chosen) {
      const priceList = await this.catalog.findPriceList(tenantId, chosen);

      if (!priceList) throw new PriceListNotFoundError(chosen.value);
      if (!priceList.isActive) throw new InactivePriceListError(chosen.value);

      return priceList;
    }

    // La del cliente se le asigno hace tiempo y pudo apagarse despues. Rechazar el pedido por eso
    // dejaria a ese cliente sin poder comprar nada, ni siquiera con un precio escrito a mano: se
    // cae a la lista por defecto, como si no tuviera ninguna.
    if (customerList) {
      const priceList = await this.catalog.findPriceList(tenantId, customerList);

      if (priceList?.isActive) return priceList;
    }

    return this.catalog.findDefaultPriceList(tenantId);
  }
}
