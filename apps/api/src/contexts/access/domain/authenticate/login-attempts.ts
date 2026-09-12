import { Email } from '../user/email.vo.js';

export const LOGIN_ATTEMPTS = Symbol('LoginAttempts');

// Cuenta intentos fallidos por correo, no peticiones por IP: la suite de pruebas entra
// decenas de veces por minuto desde la misma direccion y no debe bloquearse sola.
export interface LoginAttempts {
  isLocked(email: Email): Promise<boolean>;
  recordFailure(email: Email): Promise<void>;
  reset(email: Email): Promise<void>;
}
