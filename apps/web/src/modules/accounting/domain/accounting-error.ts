import { AccessError } from '../../access/domain/access-error';

const BY_CODE: Record<string, string> = {
  AccountNotFoundError: 'La cuenta contable no existe en esta empresa.',
  AccountParentNotFoundError: 'La cuenta padre seleccionada no existe en esta empresa.',
  AccountCodeAlreadyExistsError: 'Ya existe una cuenta con este código en la empresa.',
  AccountCannotAcceptEntriesError: 'La cuenta seleccionada es una cuenta de grupo y no acepta asientos directos.',
  AccountDisabledError: 'La cuenta contable está inactiva.',
  AccountHasChildrenError: 'La cuenta tiene subcuentas y no puede aceptar asientos directos.',
  AccountTypeMismatchError: 'El tipo de la cuenta debe coincidir con el tipo de la cuenta padre.',
  AccountResolutionFailedError: 'Falta configurar la cuenta contable requerida.',
  JournalEntryNotFoundError: 'El asiento contable no existe en esta empresa.',
  JournalEntryUnbalancedError: 'El asiento contable está descuadrado: la suma del debe no coincide con el haber.',
  InvalidJournalEntryLineError: 'Línea de asiento inválida.',
  JournalEntryAlreadyReversedError: 'El asiento contable ya ha sido revertido.',
};

export function readableAccountingError(error: unknown, fallback: string): string {
  if (error instanceof AccessError) {
    if (BY_CODE[error.code]) return BY_CODE[error.code];
    return error.message;
  }

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.code === 'string' && BY_CODE[err.code]) {
      return BY_CODE[err.code];
    }
    if (typeof err.message === 'string') {
      for (const [code, text] of Object.entries(BY_CODE)) {
        if (err.message.includes(code)) return text;
      }
    }
  }

  return fallback;
}
