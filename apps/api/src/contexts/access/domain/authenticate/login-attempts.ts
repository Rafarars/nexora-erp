import { Email } from '../user/email.vo.js';

export const LOGIN_ATTEMPTS = Symbol('LoginAttempts');

// Cuenta intentos fallidos por correo, no peticiones por IP: la suite de pruebas entra
// decenas de veces por minuto desde la misma direccion y no debe bloquearse sola.
//
// Se probo a contar tambien por direccion y se retiro: contando FALLOS castigaba a una
// oficina entera detras de una misma salida a internet, y contando solo las cuentas que
// NO existen se convertia en un oraculo —21 peticiones bastaban para saber si un correo
// estaba registrado—, que es justo lo que el tiempo constante del login protege.
export interface LoginAttempts {
  isLocked(email: Email): Promise<boolean>;
  recordFailure(email: Email): Promise<void>;
  reset(email: Email): Promise<void>;
}
