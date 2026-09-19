import { ConflictError } from '../../../../shared/domain/domain.error.js';

// La otra mitad de CannotDeactivateSelfError: quitarse el rol que administra deja igual de
// fuera que desactivarse, y si es el unico administrador la empresa se queda sin nadie capaz
// de devolver el acceso.
export class CannotDropOwnAdminRoleError extends ConflictError {
  constructor() {
    super(
      'You cannot take away your own administrator role.',
      'You cannot take away your own administrator role: someone has to be able to give access back.',
    );
  }
}
