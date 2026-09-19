import {
  ItemInOpenDocumentsError,
  ItemStopsBeingTradedError,
  ItemUnitInOpenDocumentsError,
  ItemWithMovementsError,
  ItemWithStockError,
} from '../../errors/item.errors.js';
import { UnitRef } from '../../shared/references.vo.js';
import { Item, ItemDetails } from '../item.entity.js';

// Lo que un articulo ya comprometio en existencias, kardex y documentos, leido con el articulo bloqueado.
export interface ItemCommitments {
  hasStock: boolean;
  hasMovements: boolean;
  // Las unidades de las lineas con pendiente de ordenes de compra y pedidos confirmados. Un
  // borrador no cuenta: todavia no prometio nada y se revalida al confirmarlo.
  openDocumentUnits: UnitRef[];
  // De que lado vienen esos documentos: dejar de comprar solo lo impiden las compras.
  openPurchaseOrders: boolean;
  openSalesOrders: boolean;
}

// Editar: el kardex no tolera otra base ni otro tipo, y un documento abierto no tolera que su
// unidad cambie de factor o desaparezca.
export function ensureCanChange(item: Item, details: ItemDetails, commitments: ItemCommitments): void {
  const changesIdentity = item.changesStockIdentity(details);

  if (changesIdentity && commitments.hasMovements) {
    throw new ItemWithMovementsError(item.id.value);
  }

  for (const unitId of commitments.openDocumentUnits) {
    if (!item.keepsUnit(details, unitId)) {
      throw new ItemUnitInOpenDocumentsError(item.id.value, unitId.value);
    }
  }

  if (changesIdentity && commitments.openDocumentUnits.length > 0) {
    throw new ItemInOpenDocumentsError(item.id.value);
  }

  if (item.stopsBeingPurchasable(details) && commitments.openPurchaseOrders) {
    throw new ItemStopsBeingTradedError(item.id.value, 'purchase');
  }

  if (item.stopsBeingSellable(details) && commitments.openSalesOrders) {
    throw new ItemStopsBeingTradedError(item.id.value, 'sales');
  }
}

// Desactivar: con existencia nadie podria sacarla, y con documentos abiertos nadie podria
// terminarlos.
export function ensureCanDeactivate(item: Item, commitments: ItemCommitments): void {
  if (commitments.hasStock) {
    throw new ItemWithStockError(item.id.value);
  }

  if (commitments.openDocumentUnits.length > 0) {
    throw new ItemInOpenDocumentsError(item.id.value);
  }
}
