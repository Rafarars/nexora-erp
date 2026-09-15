import { CompanyTextTooLongError, RequiredCompanyTextError } from '../errors/company.errors.js';

// Texto obligatorio con el largo de su columna: sin comprobarlo, la base lo rechazaria con un 500.
export function requiredText(value: string, max: number, name: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) throw new RequiredCompanyTextError(name);
  if (trimmed.length > max) throw new CompanyTextTooLongError(name, max);

  return trimmed;
}

// Texto opcional: vacio se guarda como null.
export function optionalText(value: string | null | undefined, max: number, name: string): string | null {
  const trimmed = value?.trim() ?? '';

  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new CompanyTextTooLongError(name, max);

  return trimmed;
}
