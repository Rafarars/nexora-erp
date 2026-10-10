import { ConflictError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

// ---------------------------------------------------------------- cuentas

export class AccountNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Account <${id}> does not exist.`, 'La cuenta contable no existe.');
  }
}

export class AccountParentNotFoundError extends NotFoundError {
  constructor(parentId: string) {
    super(`Parent account <${parentId}> does not exist.`, 'La cuenta contable padre no existe.');
  }
}

export class AccountCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(`Account with code <${code}> already exists in this tenant.`, 'Ya existe una cuenta con este código en la empresa.');
  }
}

export class InvalidAccountCodeError extends InvalidArgumentError {
  constructor(code: string) {
    super(
      `Account code must be between 1 and 20 characters, received <${code}>.`,
      'El código de cuenta debe tener entre 1 y 20 caracteres.',
    );
  }
}

export class InvalidAccountNameError extends InvalidArgumentError {
  constructor(name: string) {
    super(
      `Account name must be between 1 and 120 characters, received <${name}>.`,
      'El nombre de la cuenta debe tener entre 1 y 120 caracteres.',
    );
  }
}

export class InvalidAccountTypeError extends InvalidArgumentError {
  constructor(type: string) {
    super(
      `Invalid account type <${type}>.`,
      'El tipo de cuenta no es válido.',
    );
  }
}

export class AccountCannotAcceptEntriesError extends InvalidArgumentError {
  constructor(code: string) {
    super(
      `Account <${code}> does not accept entries because it is a group account.`,
      'La cuenta seleccionada es una cuenta de grupo y no acepta asientos directos.',
    );
  }
}

export class AccountDisabledError extends ConflictError {
  constructor(code: string) {
    super(`Account <${code}> is inactive.`, 'La cuenta contable está inactiva.');
  }
}

export class AccountHasChildrenError extends ConflictError {
  constructor(code: string) {
    super(`Account <${code}> has child accounts and cannot accept direct entries.`, 'La cuenta tiene subcuentas y no puede aceptar asientos directos.');
  }
}

export class AccountTypeMismatchError extends InvalidArgumentError {
  constructor(childType: string, parentType: string) {
    super(
      `Child account type <${childType}> must match parent account type <${parentType}>.`,
      'El tipo de la cuenta debe coincidir con el tipo de la cuenta padre.',
    );
  }
}

// ---------------------------------------------------------------- determinacion de cuentas (§2.5)

export class AccountResolutionFailedError extends InvalidArgumentError {
  constructor(purpose: string) {
    super(
      `Missing account configuration for <${purpose}>. Check item, category or company settings.`,
      `Falta configurar la cuenta contable para: ${purpose}. Configure la cuenta en el artículo, su categoría o en la empresa.`,
    );
  }
}

// ---------------------------------------------------------------- asientos (§2.1 y §2.6)

export class JournalEntryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Journal entry <${id}> does not exist.`, 'El asiento contable no existe.');
  }
}

export class JournalEntryUnbalancedError extends InvalidArgumentError {
  constructor(totalDebit: number, totalCredit: number) {
    super(
      `Journal entry is unbalanced: total debit <${totalDebit}> does not equal total credit <${totalCredit}>.`,
      'El asiento contable está descuadrado: la suma del debe no coincide con la suma del haber.',
    );
  }
}

export class InvalidJournalEntryLineError extends InvalidArgumentError {
  constructor(reason: string) {
    super(
      `Invalid journal entry line: ${reason}.`,
      'Línea de asiento inválida. Debe tener un monto positivo en el debe o en el haber, no en ambos ni en cero.',
    );
  }
}

export class JournalEntryAlreadyReversedError extends ConflictError {
  constructor(entryId: string) {
    super(`Journal entry <${entryId}> has already been reversed.`, 'El asiento contable ya ha sido revertido previamente.');
  }
}

// ---------------------------------------------------------------- asiento de apertura (§3.13)

export class OpeningBalanceAlreadyExistsError extends ConflictError {
  constructor() {
    super(
      'An opening balance journal entry already exists for this tenant.',
      'El asiento de apertura ya fue registrado para esta empresa.',
    );
  }
}

export class NoOpeningBalancesFoundError extends InvalidArgumentError {
  constructor() {
    super(
      'No open balances found to generate opening balance entry.',
      'No se encontraron saldos vivos iniciales para generar el asiento de apertura.',
    );
  }
}
