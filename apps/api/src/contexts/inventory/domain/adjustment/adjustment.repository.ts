import { TenantId } from '../shared/tenant-id.vo.js';
import { Adjustment, AdjustmentId } from './adjustment.entity.js';

export const ADJUSTMENT_REPOSITORY = Symbol('AdjustmentRepository');

// Guarda borradores. Confirmar y anular no pasan por aqui sino por AdjustmentPosting, que
// escribe el ajuste junto con sus movimientos y existencias.
export interface AdjustmentRepository {
  save(adjustment: Adjustment): Promise<void>;
  find(tenantId: TenantId, id: AdjustmentId): Promise<Adjustment | null>;
  searchByTenant(tenantId: TenantId): Promise<Adjustment[]>;
}
