// Base de todos los errores de dominio. Las subclases marcan la CATEGORIA, no el
// codigo HTTP: el dominio no sabe que existe HTTP. Un filtro traduce en la frontera.
//
// Dos mensajes a proposito: `message` lleva detalles para registros y pruebas
// (identificadores, valores recibidos) y NUNCA sale por HTTP; `publicMessage` es lo
// unico que ve quien llama.
export abstract class DomainError extends Error {
  readonly publicMessage: string;

  constructor(message: string, publicMessage?: string) {
    super(message);
    this.name = new.target.name;
    this.publicMessage = publicMessage ?? this.defaultPublicMessage();
  }

  protected abstract defaultPublicMessage(): string;
}

export abstract class NotFoundError extends DomainError {
  protected defaultPublicMessage(): string {
    return 'The requested resource does not exist.';
  }
}

export abstract class ConflictError extends DomainError {
  protected defaultPublicMessage(): string {
    return 'The request conflicts with existing data.';
  }
}

export abstract class InvalidArgumentError extends DomainError {
  protected defaultPublicMessage(): string {
    return 'The request contains invalid data.';
  }
}

export abstract class UnauthorizedError extends DomainError {
  protected defaultPublicMessage(): string {
    return 'Authentication failed.';
  }
}

export abstract class ForbiddenError extends DomainError {
  protected defaultPublicMessage(): string {
    return 'You are not allowed to perform this action.';
  }
}

export abstract class TooManyRequestsError extends DomainError {
  protected defaultPublicMessage(): string {
    return 'Too many requests. Try again later.';
  }
}
