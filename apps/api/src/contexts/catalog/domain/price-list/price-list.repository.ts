import { TenantId } from '../shared/tenant-id.vo.js';
import { PriceListId } from './price-list-id.vo.js';
import { PriceListName } from './price-list-name.vo.js';
import { PriceList } from './price-list.entity.js';

export const PRICE_LIST_REPOSITORY = Symbol('PriceListRepository');

// `saveAll` escribe varias listas de una vez: mover la marca de por defecto toca dos y nadie debe
// ver un instante con ninguna o con dos.
export interface PriceListRepository {
  save(priceList: PriceList): Promise<void>;
  saveAll(priceLists: PriceList[]): Promise<void>;
  find(tenantId: TenantId, id: PriceListId): Promise<PriceList | null>;
  findByName(tenantId: TenantId, name: PriceListName): Promise<PriceList | null>;
  findDefault(tenantId: TenantId): Promise<PriceList | null>;
  searchByTenant(tenantId: TenantId): Promise<PriceList[]>;
}
