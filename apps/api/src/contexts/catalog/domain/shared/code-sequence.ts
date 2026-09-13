import { CodePrefix } from './catalog-code.vo.js';
import { TenantId } from './tenant-id.vo.js';

export const CODE_SEQUENCE = Symbol('CodeSequence');

// Entrega el siguiente numero para un prefijo dentro de una empresa. Tiene que ser
// atomico: dos altas a la vez nunca pueden recibir el mismo. Un alta que falla despues
// deja un hueco en la numeracion, y eso es aceptable; un duplicado no.
export interface CodeSequence {
  next(tenantId: TenantId, prefix: CodePrefix): Promise<number>;
}
