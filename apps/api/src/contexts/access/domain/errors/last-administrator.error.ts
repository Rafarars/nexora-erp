import { ConflictError } from '../../../../shared/domain/domain.error.js';

// Lo que CannotDropOwnAdminRoleError y CannotDeactivateSelfError solo cubrian para uno
// mismo: tambien se deja a la empresa sin gobierno quitandole la administracion al ultimo
// que queda, o desactivandolo. Da igual quien lo haga, y da igual por que puerta.
export class LastAdministratorError extends ConflictError {
  constructor() {
    super(
      'The tenant would be left without an administrator.',
      'The company would be left without anyone who can administer it.',
    );
  }
}
