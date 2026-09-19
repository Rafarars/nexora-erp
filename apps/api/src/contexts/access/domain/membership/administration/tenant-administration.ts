import { TenantId } from '../../tenant/tenant-id.vo.js';
import { UserId } from '../../user/user-id.vo.js';

export const TENANT_ADMINISTRATION = Symbol('TenantAdministration');

// Lo que hace falta saber antes de quitarle la administracion a alguien o desactivarlo.
// Una empresa sin nadie que la administre no se arregla desde dentro: ninguna pantalla
// crea un rol que lo conceda todo, asi que el acceso no se puede devolver.
export interface TenantAdministration {
  // Cuantas personas ACTIVAS administran la empresa, sin contar a la indicada.
  countAdministratorsExcept(tenantId: TenantId, userId: UserId): Promise<number>;
}
