import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';

// No es un 401: la sesion es valida y lo que falla es un dato del formulario. Tampoco
// dice "correo o contrasena": en ese formulario no hay correo.
export class WrongCurrentPasswordError extends InvalidArgumentError {
  constructor() {
    super('The current password does not match.', 'The current password is not correct.');
  }
}
