import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';

// Un rol sin nada marcado no da acceso a nada: quien lo asigna cree estar dando algo.
export class RoleWithoutPermissionsError extends InvalidArgumentError {
  constructor() {
    super('A role must grant at least one permission.', 'A role must grant at least one permission.');
  }
}
