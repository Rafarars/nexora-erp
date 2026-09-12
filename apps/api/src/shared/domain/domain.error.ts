// Base de todos los errores de dominio. Las subclases marcan la CATEGORIA, no el
// codigo HTTP: el dominio no sabe que existe HTTP. Un filtro traduce en la frontera.
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export abstract class NotFoundError extends DomainError {}
export abstract class ConflictError extends DomainError {}
export abstract class InvalidArgumentError extends DomainError {}
export abstract class UnauthorizedError extends DomainError {}
export abstract class ForbiddenError extends DomainError {}
export abstract class TooManyRequestsError extends DomainError {}
