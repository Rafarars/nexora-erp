import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import {
  InvalidJournalEntryLineError,
  JournalEntryAlreadyReversedError,
  JournalEntryUnbalancedError,
} from '../errors/accounting.errors.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { JournalEntryLine, JournalEntryLinePrimitives } from './journal-entry-line.entity.js';

export interface JournalEntryPrimitives {
  id: string;
  tenantId: string;
  code: string;
  entryDate: string;
  originType: string;
  originId: string;
  description: string;
  currency: string;
  reversalOfId: string | null;
  lines: JournalEntryLinePrimitives[];
}

export class JournalEntry {
  private constructor(
    readonly id: string,
    readonly tenantId: TenantId,
    readonly code: string,
    readonly entryDate: Date,
    readonly originType: string,
    readonly originId: string,
    readonly description: string,
    readonly currency: string,
    readonly reversalOfId: string | null,
    readonly lines: readonly JournalEntryLine[],
  ) {
    if (!id || typeof id !== 'string') {
      throw new Error('JournalEntry id is required');
    }
    if (!code || code.trim().length === 0 || code.length > 12) {
      throw new Error('JournalEntry code must be between 1 and 12 characters');
    }
    if (!originType || originType.trim().length === 0 || originType.length > 30) {
      throw new Error('JournalEntry originType must be between 1 and 30 characters');
    }
    if (!originId || typeof originId !== 'string') {
      throw new Error('JournalEntry originId is required');
    }
    if (!description || description.trim().length === 0 || description.length > 200) {
      throw new Error('JournalEntry description must be between 1 and 200 characters');
    }
    if (!currency || currency.length !== 3) {
      throw new Error('JournalEntry currency must be a 3-character ISO code');
    }
    if (!lines || lines.length < 2) {
      throw new InvalidJournalEntryLineError('a journal entry must contain at least two lines');
    }

    // Invariante absoluta: debit === credit al céntimo/diezmilésima
    const totalDebitUnits = lines.reduce((acc, l) => acc + amountUnits(l.debit), 0n);
    const totalCreditUnits = lines.reduce((acc, l) => acc + amountUnits(l.credit), 0n);

    if (totalDebitUnits !== totalCreditUnits) {
      throw new JournalEntryUnbalancedError(
        unitsToNumber(totalDebitUnits),
        unitsToNumber(totalCreditUnits),
      );
    }
  }

  static create(params: {
    id: string;
    tenantId: TenantId;
    code: string;
    entryDate: Date;
    originType: string;
    originId: string;
    description: string;
    currency: string;
    reversalOfId?: string | null;
    lines: JournalEntryLine[];
  }): JournalEntry {
    return new JournalEntry(
      params.id,
      params.tenantId,
      params.code,
      params.entryDate,
      params.originType,
      params.originId,
      params.description,
      params.currency,
      params.reversalOfId ?? null,
      params.lines,
    );
  }

  static fromPrimitives(primitives: JournalEntryPrimitives): JournalEntry {
    return new JournalEntry(
      primitives.id,
      TenantId.of(primitives.tenantId),
      primitives.code,
      new Date(primitives.entryDate),
      primitives.originType,
      primitives.originId,
      primitives.description,
      primitives.currency,
      primitives.reversalOfId,
      primitives.lines.map((l) => JournalEntryLine.fromPrimitives(l)),
    );
  }

  toPrimitives(): JournalEntryPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId.value,
      code: this.code,
      entryDate: this.entryDate.toISOString(),
      originType: this.originType,
      originId: this.originId,
      description: this.description,
      currency: this.currency,
      reversalOfId: this.reversalOfId,
      lines: this.lines.map((l) => l.toPrimitives()),
    };
  }

  totalDebit(): number {
    const units = this.lines.reduce((acc, l) => acc + amountUnits(l.debit), 0n);
    return unitsToNumber(units);
  }

  totalCredit(): number {
    const units = this.lines.reduce((acc, l) => acc + amountUnits(l.credit), 0n);
    return unitsToNumber(units);
  }

  reverse(params: {
    id: string;
    code: string;
    date: Date;
    description: string;
    lineIds?: (index: number) => string;
  }): JournalEntry {
    if (this.reversalOfId !== null) {
      throw new JournalEntryAlreadyReversedError(this.id);
    }

    const reversedLines = this.lines.map((l, index) => {
      const newLineId = params.lineIds ? params.lineIds(index) : `rev-${l.id}`;
      return JournalEntryLine.create({
        id: newLineId,
        accountId: l.accountId,
        debit: l.credit,
        credit: l.debit,
        label: `Reverso: ${l.label}`,
      });
    });

    return new JournalEntry(
      params.id,
      this.tenantId,
      params.code,
      params.date,
      'reversal',
      this.originId,
      params.description,
      this.currency,
      this.id,
      reversedLines,
    );
  }
}
