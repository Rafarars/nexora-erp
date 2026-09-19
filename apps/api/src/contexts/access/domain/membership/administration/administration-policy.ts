import { LastAdministratorError } from '../../errors/last-administrator.error.js';
import { TenantId } from '../../tenant/tenant-id.vo.js';
import { UserId } from '../../user/user-id.vo.js';
import { TenantAdministration } from './tenant-administration.js';

// La regla en UN solo sitio, por la misma razon que SignInPolicy: tres caminos distintos
// dejan a alguien sin administrar —editar sus roles, revocarle el rol y desactivarlo— y la
// revision encontro que uno comprobaba solo el caso propio y los otros dos, nada.
export class AdministrationPolicy {
  // `stillAdministers` es como queda la persona DESPUES del cambio: quien conserva otro rol
  // que lo concede todo no deja hueco, y bloquearlo seria un no por un peligro inexistente.
  static async ensureTenantKeepsAnAdministrator(
    administration: TenantAdministration,
    tenantId: TenantId,
    userId: UserId,
    stillAdministers: boolean,
  ): Promise<void> {
    if (stillAdministers) {
      return;
    }

    if ((await administration.countAdministratorsExcept(tenantId, userId)) === 0) {
      throw new LastAdministratorError();
    }
  }
}
