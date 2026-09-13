export type AccessErrorKind =
  | 'credentials'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'invalid'
  | 'rate-limited'
  | 'unknown';

export interface AccessErrorBody {
  message?: string;
  code?: string;
  fields?: string[];
}

// Lo que la interfaz necesita saber de un fallo: su categoria, el codigo del error y
// los campos que fallaron. El texto que manda la API no se le ensena a nadie.
export class AccessError extends Error {
  constructor(
    message: string,
    readonly kind: AccessErrorKind,
    readonly code = '',
    readonly fields: string[] = [],
  ) {
    super(message);
    this.name = 'AccessError';
  }

  static fromStatus(status: number, body: AccessErrorBody = {}): AccessError {
    return new AccessError(body.message ?? '', kindOf(status), body.code ?? '', body.fields ?? []);
  }
}

function kindOf(status: number): AccessErrorKind {
  if (status === 401) return 'credentials';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400) return 'invalid';
  if (status === 429) return 'rate-limited';

  return 'unknown';
}

const BY_CODE: Record<string, string> = {
  InvalidCredentialsError: 'Correo o contraseña incorrectos.',
  TooManyLoginAttemptsError: 'Demasiados intentos fallidos. Espera unos minutos y vuelve a probar.',
  NoActiveMembershipError:
    'Tu cuenta no tiene acceso activo a ninguna empresa. Pídele a un administrador que lo reactive.',
  InactiveMembershipError: 'Tu acceso a esta empresa no está activo.',
  InactiveTenantError: 'Esta empresa está suspendida.',
  InactiveUserError: 'Tu cuenta está desactivada.',
  InvalidTokenError: 'Tu sesión ya no es válida. Vuelve a entrar.',
  WrongCurrentPasswordError: 'La contraseña actual no es correcta.',
  WeakPasswordError: 'La contraseña debe tener al menos 8 caracteres.',
  InvalidEmailError: 'Escribe un correo válido.',
  EmptyStringValueError: 'Rellena todos los campos.',
  EmailAlreadyInUseError: 'Ese correo ya está registrado.',
  DuplicateRoleNameError: 'Ya existe un rol con ese nombre.',
  DuplicateMembershipError: 'Esa persona ya pertenece a esta empresa.',
  CannotDeactivateSelfError: 'No puedes desactivarte a ti mismo.',
  UnknownPermissionError: 'Uno de los permisos marcados no existe.',
  PermissionDeniedError: 'Tu rol no te permite hacer esto.',
};

// El primer campo conocido decide el mensaje: una persona corrige un campo a la vez.
const BY_FIELD: Record<string, string> = {
  password: 'La contraseña debe tener al menos 8 caracteres.',
  next: 'La nueva contraseña debe tener al menos 8 caracteres.',
  current: 'Escribe tu contraseña actual.',
  email: 'Escribe un correo válido.',
  name: 'Escribe un nombre.',
};

const BY_KIND: Record<AccessErrorKind, string | null> = {
  credentials: 'No se pudo verificar tu identidad.',
  forbidden: 'Tu rol no te permite hacer esto.',
  'not-found': 'Eso ya no existe en esta empresa.',
  conflict: 'Ese dato ya existe.',
  invalid: 'Revisa los datos del formulario.',
  'rate-limited': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  unknown: null,
};

// Lo que se le ensena a una persona, siempre en espanol y sin el texto tecnico de la
// API: primero por codigo, luego por campo, luego por categoria.
export function readableError(error: unknown, fallback: string): string {
  if (!(error instanceof AccessError)) {
    return fallback;
  }

  if (BY_CODE[error.code]) {
    return BY_CODE[error.code];
  }

  const field = error.fields.find((candidate) => BY_FIELD[candidate]);

  if (field) {
    return BY_FIELD[field];
  }

  return BY_KIND[error.kind] ?? fallback;
}
