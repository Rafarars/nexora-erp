import { TenantId } from '../shared/tenant-id.vo.js';
import { Adjustment, AdjustmentId, AdjustmentStatus, AdjustmentType } from './adjustment.entity.js';

export const ADJUSTMENT_REPOSITORY = Symbol('AdjustmentRepository');

// Lo que la pantalla ofrece filtrar. Todo opcional: sin nada, la primera pagina de todos.
export interface AdjustmentCriteria {
  // Busca en el codigo y en las notas.
  text: string | null;
  warehouseId: string | null;
  status: AdjustmentStatus | null;
  type: AdjustmentType | null;
  // Contra la fecha que el ajuste declara, no contra cuando se confirmo.
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
}

// Guarda borradores. Confirmar y anular no pasan por aqui sino por AdjustmentPosting, que
// escribe el ajuste junto con sus movimientos y existencias.
export interface AdjustmentRepository {
  save(adjustment: Adjustment): Promise<void>;
  find(tenantId: TenantId, id: AdjustmentId): Promise<Adjustment | null>;
  // Una pagina, del mas reciente al mas viejo: `total` es cuantos cumplen el filtro.
  search(tenantId: TenantId, criteria: AdjustmentCriteria): Promise<{ adjustments: Adjustment[]; total: number }>;
}
