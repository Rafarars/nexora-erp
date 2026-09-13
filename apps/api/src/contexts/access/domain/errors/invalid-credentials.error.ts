import { UnauthorizedError } from '../../../../shared/domain/domain.error.js';

// Mensaje unico a proposito: no revela si fallo el correo o la contrasena.
export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('Invalid credentials.', 'Invalid credentials.');
  }
}
