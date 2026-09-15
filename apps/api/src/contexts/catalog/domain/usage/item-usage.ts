import { CategoryId } from '../category/category-id.vo.js';
import { MeasurementUnitId } from '../measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { TaxId } from '../tax/tax-id.vo.js';

export const ITEM_USAGE = Symbol('ItemUsage');

// Lo que el catalogo necesita saber de los articulos, que viven en el inventario, sin importar
// ese contexto: el adaptador lo pregunta a sus tablas. Preguntas y no listas: para decidir si
// algo se puede desactivar basta con saber si hay al menos un articulo activo que lo use.
export interface ItemUsage {
  activeItemUsesCategory(tenantId: TenantId, categoryId: CategoryId): Promise<boolean>;
  activeItemUsesTax(tenantId: TenantId, taxId: TaxId): Promise<boolean>;
  activeItemUsesUnit(tenantId: TenantId, unitId: MeasurementUnitId): Promise<boolean>;
}
