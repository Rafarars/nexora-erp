import { Email } from '../user/email.vo.js';

export const LOGIN_ATTEMPTS = Symbol('LoginAttempts');

// De donde viene el intento. Contar SOLO por correo deja dejar fuera a cualquiera a
// proposito: bastan cinco intentos fallidos sabiendo su direccion.
export interface LoginAttempt {
  email: Email;
  ip: string;
}

export interface LoginAttempts {
  isLocked(attempt: LoginAttempt): Promise<boolean>;
  // `accountExists` decide si el fallo cuenta ADEMAS para la direccion: equivocarse de
  // contrasena en una cuenta real es un despiste, y contarlo dejaria fuera a una oficina
  // entera detras de una misma salida a internet. Probar correos que no existen es otra
  // cosa: es adivinar a quien hay, y eso si se frena por direccion.
  recordFailure(attempt: LoginAttempt, accountExists: boolean): Promise<void>;
  reset(attempt: LoginAttempt): Promise<void>;
}
