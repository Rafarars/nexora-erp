// Lo que la interfaz necesita saber de un fallo: que decirle a la persona y si vale
// la pena reintentar. El codigo HTTP no sale de aqui.
export class AccessError extends Error {
  constructor(
    message: string,
    readonly kind: 'credentials' | 'forbidden' | 'not-found' | 'conflict' | 'invalid' | 'unknown',
  ) {
    super(message);
    this.name = 'AccessError';
  }

  static fromStatus(status: number, message: string): AccessError {
    if (status === 401) return new AccessError(message, 'credentials');
    if (status === 403) return new AccessError(message, 'forbidden');
    if (status === 404) return new AccessError(message, 'not-found');
    if (status === 409) return new AccessError(message, 'conflict');
    if (status === 400) return new AccessError(message, 'invalid');

    return new AccessError(message, 'unknown');
  }
}

// Lo que se le ensena a una persona. El mensaje que devuelve la API es para quien
// depura; este es para quien esta usando el sistema.
export function readableError(error: unknown, fallback: string): string {
  if (!(error instanceof AccessError)) {
    return fallback;
  }

  if (error.kind === 'credentials') return 'Correo o contraseña incorrectos.';
  if (error.kind === 'forbidden') return 'Tu rol no te permite hacer esto.';
  if (error.kind === 'conflict') return 'Ya existe algo con ese nombre o ese correo.';
  if (error.kind === 'invalid') return error.message || 'Revisa los datos del formulario.';
  if (error.kind === 'not-found') return 'Eso ya no existe en esta empresa.';

  return fallback;
}
