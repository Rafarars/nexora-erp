import { PayablesTextTooLongError } from '../errors/payables.errors.js';

// Texto opcional: vacio o solo espacios se guarda como null.
export function optionalText(value: string | null | undefined, max: number, name: string): string | null {
  const trimmed = value?.trim() ?? '';

  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new PayablesTextTooLongError(name, max);

  return trimmed;
}
