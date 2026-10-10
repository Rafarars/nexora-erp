import { InvalidAccountCodeError } from '../errors/accounting.errors.js';

export class AccountCode {
  private constructor(private readonly value: string) {}

  static of(raw: string): AccountCode {
    const trimmed = raw?.trim();
    if (!trimmed || trimmed.length > 20) {
      throw new InvalidAccountCodeError(raw);
    }
    return new AccountCode(trimmed);
  }

  get raw(): string {
    return this.value;
  }

  equals(other: AccountCode): boolean {
    return this.value === other.value;
  }
}
