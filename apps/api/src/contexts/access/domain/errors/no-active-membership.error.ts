import { UnauthorizedError } from '../../../../shared/domain/domain.error.js';

// Solo llega aqui quien acerto la contrasena: decirle que no tiene acceso activo no le
// da pistas a nadie que no sea ya el dueno de la cuenta, y le evita creer que se
// equivoco de contrasena.
export class NoActiveMembershipError extends UnauthorizedError {
  constructor(userId: string) {
    super(
      `User <${userId}> has no active membership.`,
      'Your account has no active access to any company.',
    );
  }
}
