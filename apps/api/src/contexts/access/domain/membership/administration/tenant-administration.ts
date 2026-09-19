import { TenantId } from '../../tenant/tenant-id.vo.js';
import { UserId } from '../../user/user-id.vo.js';

export const TENANT_ADMINISTRATION = Symbol('TenantAdministration');

// Lo que hace falta saber antes de quitarle la administracion a alguien o desactivarlo.
// Una empresa sin nadie que la administre no se arregla desde dentro: ninguna pantalla
// crea un rol que lo conceda todo, asi que el acceso no se puede devolver.
export interface TenantAdministration {
  // Comprobar y escribir en peticiones distintas dejaba una carrera: dos peticiones a la
  // vez contaban antes de que la otra escribiera, y las dos se daban por buenas. Con esto
  // la segunda espera a que la primera termine y ya ve su cambio.
  whileNobodyElseChangesIt<T>(tenantId: TenantId, work: () => Promise<T>): Promise<T>;

  // Cuantas personas ACTIVAS administran la empresa, sin contar a la indicada.
  countAdministratorsExcept(tenantId: TenantId, userId: UserId): Promise<number>;
}
