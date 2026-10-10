import { InvalidJournalEntryLineError } from '../errors/accounting.errors.js';

export interface JournalEntryLinePrimitives {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  label: string;
}

export class JournalEntryLine {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly debit: number,
    readonly credit: number,
    readonly label: string,
  ) {
    if (!accountId || typeof accountId !== 'string') {
      throw new InvalidJournalEntryLineError('accountId is required and must be a valid identifier');
    }
    if (!label || label.trim().length === 0) {
      throw new InvalidJournalEntryLineError('label is required');
    }
    if (debit < 0 || credit < 0) {
      throw new InvalidJournalEntryLineError('debit and credit must be non-negative');
    }
    const isDebitOnly = debit > 0 && credit === 0;
    const isCreditOnly = credit > 0 && debit === 0;
    if (!isDebitOnly && !isCreditOnly) {
      throw new InvalidJournalEntryLineError('line must have either debit > 0 or credit > 0, never both nor both zero');
    }
  }

  static create(params: {
    id: string;
    accountId: string;
    debit: number;
    credit: number;
    label: string;
  }): JournalEntryLine {
    return new JournalEntryLine(params.id, params.accountId, params.debit, params.credit, params.label);
  }

  static debit(params: { id: string; accountId: string; amount: number; label: string }): JournalEntryLine {
    return new JournalEntryLine(params.id, params.accountId, params.amount, 0, params.label);
  }

  static credit(params: { id: string; accountId: string; amount: number; label: string }): JournalEntryLine {
    return new JournalEntryLine(params.id, params.accountId, 0, params.amount, params.label);
  }

  static fromPrimitives(primitives: JournalEntryLinePrimitives): JournalEntryLine {
    return new JournalEntryLine(
      primitives.id,
      primitives.accountId,
      primitives.debit,
      primitives.credit,
      primitives.label,
    );
  }

  toPrimitives(): JournalEntryLinePrimitives {
    return {
      id: this.id,
      accountId: this.accountId,
      debit: this.debit,
      credit: this.credit,
      label: this.label,
    };
  }

  isDebit(): boolean {
    return this.debit > 0;
  }

  isCredit(): boolean {
    return this.credit > 0;
  }

  amount(): number {
    return this.debit > 0 ? this.debit : this.credit;
  }
}
