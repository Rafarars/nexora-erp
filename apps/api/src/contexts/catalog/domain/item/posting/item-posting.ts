import { TenantId } from '../../shared/tenant-id.vo.js';
import { ItemCommitments } from '../commitments/item-commitments.js';
import { ItemId } from '../item-id.vo.js';
import { Item } from '../item.entity.js';

export const ITEM_POSTING = Symbol('ItemPosting');

// Cambia un articulo con su fila bloqueada. Antes del trabajo lee lo que el articulo ya
// comprometio, y guarda lo que el trabajo deje, todo en la misma transaccion: un documento que
// mueve su existencia a la vez espera al cambio, o el cambio espera al documento, y el segundo ve
// lo que dejo el primero. `work` es sincrono y puro: si lanza, no se escribe nada.
export interface ItemPosting {
  post(tenantId: TenantId, itemId: ItemId, work: (item: Item, commitments: ItemCommitments) => void): Promise<void>;
}
