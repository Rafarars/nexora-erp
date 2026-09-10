import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';
import { StringValueObject } from '../../../../shared/domain/value-object.js';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class InvalidTenantSlugError extends InvalidArgumentError {
  constructor(value: string) {
    super(`TenantSlug must be lowercase words joined by hyphens, received <${value}>.`);
  }
}

// Identificador legible de la empresa: viaja en URLs y en el selector de empresa,
// asi que no admite mayusculas, espacios ni acentos.
export class TenantSlug extends StringValueObject {
  private constructor(value: string) {
    super(value);

    if (!SLUG_PATTERN.test(value)) {
      throw new InvalidTenantSlugError(value);
    }
  }

  static of(value: string): TenantSlug {
    return new TenantSlug(value.trim().toLowerCase());
  }
}
