import { StringValueObject } from '../../../../shared/domain/value-object.js';
import { InventoryTextTooLongError } from '../errors/inventory.errors.js';

// Texto obligatorio con largo maximo. El limite es el de la columna: sin comprobarlo
// aqui, la base lo rechazaria con un error ilegible y un 500.
export abstract class BoundedText extends StringValueObject {
  protected constructor(value: string, max: number) {
    super(value.trim());

    if (this.value.length > max) {
      throw new InventoryTextTooLongError(new.target.name, max);
    }
  }
}

// Texto opcional: vacio o solo espacios se guarda como null, no como cadena vacia.
export function optionalText(value: string | null | undefined, max: number, name: string): string | null {
  const trimmed = value?.trim() ?? '';

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > max) {
    throw new InventoryTextTooLongError(name, max);
  }

  return trimmed;
}
