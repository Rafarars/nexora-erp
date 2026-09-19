import { Clock } from '../../../../shared/domain/ports/clock.js';
import { LoginAttempts } from '../../domain/authenticate/login-attempts.js';
import { Email } from '../../domain/user/email.vo.js';

interface Entry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

// Cuantas entradas se toleran antes de barrer las caducadas. Sin esto, cada correo
// inventado dejaba una que no se iba nunca.
const SWEEP_AT = 1_000;

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
    const entry = this.expired(current, now)
      ? { failures: 0, firstFailureAt: now, lockedUntil: 0 }
      : current!;

    entry.failures += 1;

    if (entry.failures >= this.maxFailures) {
      entry.lockedUntil = now + this.lockoutSeconds * 1000;
      // La ventana arranca de nuevo al bloquear: sin esto, un fallo posterior podia caer
      // fuera de la ventana vieja, reiniciar el contador y levantar el bloqueo antes.
      entry.firstFailureAt = now;
    }

    this.entries.set(email.value, entry);
    this.sweep();
  }

  async reset(email: Email): Promise<void> {
    this.entries.delete(email.value);
  }

  private expired(entry: { firstFailureAt: number } | undefined, now: number): boolean {
    return !entry || now - entry.firstFailureAt > this.lockoutSeconds * 1000;
  }

  // Solo borra las caducadas, asi que bajo ataque sostenido el mapa crece igual: acota el
  // rastro de correos inventados, no el coste de un ataque en curso.
  private sweep(): void {
    if (this.entries.size <= SWEEP_AT) {
      return;
    }

    const now = this.now();

    for (const [key, entry] of this.entries) {
      if (entry.lockedUntil <= now && this.expired(entry, now)) {
        this.entries.delete(key);
      }
    }
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
