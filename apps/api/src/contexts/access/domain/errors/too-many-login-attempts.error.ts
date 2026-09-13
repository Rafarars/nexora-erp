import { TooManyRequestsError } from '../../../../shared/domain/domain.error.js';

// No dice cuantos intentos quedan ni si el correo existe: seria dar pistas a quien prueba.
export class TooManyLoginAttemptsError extends TooManyRequestsError {
  constructor() {
    super('Too many failed attempts. Try again later.', 'Too many failed attempts. Try again later.');
  }
}
