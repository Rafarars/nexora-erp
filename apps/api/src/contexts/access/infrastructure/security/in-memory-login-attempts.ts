import { Clock } from '../../../../shared/domain/ports/clock.js';
import { LoginAttempts } from '../../domain/authenticate/login-attempts.js';
import { Email } from '../../domain/user/email.vo.js';

interface Entry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

// En memoria del proceso: suficiente con una sola instancia de la API. Con varias,
// cada una contaria por su lado y el limite se multiplicaria; ahi hace falta Redis.
export class InMemoryLoginAttempts implements LoginAttempts {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxFailures: number,
    private readonly lockoutSeconds: number,
    private readonly clock: Clock,
  ) {}

  async isLocked(email: Email): Promise<boolean> {
    const entry = this.entries.get(email.value);

    return entry !== undefined && entry.lockedUntil > this.now();
  }

  async recordFailure(email: Email): Promise<void> {
    const now = this.now();
    const current = this.entries.get(email.value);
    const windowExpired = !current || now - current.firstFailureAt > this.lockoutSeconds * 1000;
    const entry = windowExpired ? { failures: 0, firstFailureAt: now, lockedUntil: 0 } : current;

    entry.failures += 1;

    if (entry.failures >= this.maxFailures) {
      entry.lockedUntil = now + this.lockoutSeconds * 1000;
    }

    this.entries.set(email.value, entry);
  }

  async reset(email: Email): Promise<void> {
    this.entries.delete(email.value);
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
