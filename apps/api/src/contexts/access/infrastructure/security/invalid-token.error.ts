import { UnauthorizedError } from '../../../../shared/domain/domain.error.js';

// Un token caducado y uno falsificado responden igual: al que prueba firmas no se le
// dice cual de las dos cosas fallo.
export class InvalidTokenError extends UnauthorizedError {
  constructor() {
    super('Invalid or expired session.', 'Invalid or expired session.');
  }
}
