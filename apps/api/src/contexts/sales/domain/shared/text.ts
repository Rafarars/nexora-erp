import { EmptySalesTextError, SalesTextTooLongError } from '../errors/sales.errors.js';

// Texto obligatorio con largo maximo: el limite es el de la columna.
export function requiredText(value: string, max: number, name: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) throw new EmptySalesTextError(name);
  if (trimmed.length > max) throw new SalesTextTooLongError(name, max);

  return trimmed;
}

// Texto opcional: vacio o solo espacios se guarda como null.
export function optionalText(value: string | null | undefined, max: number, name: string): string | null {
  const trimmed = value?.trim() ?? '';

  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new SalesTextTooLongError(name, max);

  return trimmed;
}
