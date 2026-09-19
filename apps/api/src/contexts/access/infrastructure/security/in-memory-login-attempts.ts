import { Clock } from '../../../../shared/domain/ports/clock.js';
import { LoginAttempt, LoginAttempts } from '../../domain/authenticate/login-attempts.js';

interface Entry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

// Por direccion se cuentan CUANTOS CORREOS INEXISTENTES DISTINTOS se prueban. No fallos, y
// no cuentas reales: quien se equivoca de contrasena en su propia cuenta ya lo frena el
// limite por correo, y contarlo aqui dejaria fuera a una oficina entera detras de una misma
// salida a internet. Lo que esto frena es adivinar a quien hay.
interface Sweep {
  emails: Set<string>;
  firstFailureAt: number;
  lockedUntil: number;
}

// Cuantas entradas se toleran antes de barrer las caducadas. Sin esto, cada correo
// inventado dejaba una que no se iba nunca.
const SWEEP_AT = 1_000;

// En memoria del proceso: suficiente con una sola instancia de la API. Con varias,
// cada una contaria por su lado y el limite se multiplicaria; ahi hace falta Redis.
export class InMemoryLoginAttempts implements LoginAttempts {
  private readonly byEmail = new Map<string, Entry>();
  private readonly byIp = new Map<string, Sweep>();

  constructor(
    private readonly maxFailuresPerEmail: number,
    private readonly maxUnknownAccountsPerIp: number,
    private readonly lockoutSeconds: number,
    private readonly clock: Clock,
  ) {}

  async isLocked(attempt: LoginAttempt): Promise<boolean> {
    const now = this.now();
    const email = this.byEmail.get(attempt.email.value);
    const ip = this.byIp.get(attempt.ip);

    return (email?.lockedUntil ?? 0) > now || (ip?.lockedUntil ?? 0) > now;
  }

  async recordFailure(attempt: LoginAttempt, accountExists: boolean): Promise<void> {
    this.countForEmail(attempt.email.value);

    if (!accountExists) {
      this.countForIp(attempt.ip, attempt.email.value);
    }
  }

  // Solo el correo: acertar una contrasena no deberia limpiarle el rastro a quien lleva
  // rato barriendo cuentas ajenas desde la misma direccion.
  async reset(attempt: LoginAttempt): Promise<void> {
    this.byEmail.delete(attempt.email.value);
  }

  private countForEmail(email: string): void {
    const now = this.now();
    const current = this.byEmail.get(email);
    const entry = this.expired(current, now)
      ? { failures: 0, firstFailureAt: now, lockedUntil: 0 }
      : current!;

    entry.failures += 1;

    if (entry.failures >= this.maxFailuresPerEmail) {
      entry.lockedUntil = now + this.lockoutSeconds * 1000;
    }

    this.byEmail.set(email, entry);
    this.sweepEmails();
  }

  private countForIp(ip: string, email: string): void {
    const now = this.now();
    const current = this.byIp.get(ip);
    const entry = this.expired(current, now)
      ? { emails: new Set<string>(), firstFailureAt: now, lockedUntil: 0 }
      : current!;

    entry.emails.add(email);

    if (entry.emails.size >= this.maxUnknownAccountsPerIp) {
      entry.lockedUntil = now + this.lockoutSeconds * 1000;
    }

    this.byIp.set(ip, entry);
    this.sweepIps();
  }

  private expired(entry: { firstFailureAt: number } | undefined, now: number): boolean {
    return !entry || now - entry.firstFailureAt > this.lockoutSeconds * 1000;
  }

  private sweepEmails(): void {
    if (this.byEmail.size <= SWEEP_AT) return;

    const now = this.now();

    for (const [key, entry] of this.byEmail) {
      if (entry.lockedUntil <= now && this.expired(entry, now)) this.byEmail.delete(key);
    }
  }

  private sweepIps(): void {
    if (this.byIp.size <= SWEEP_AT) return;

    const now = this.now();

    for (const [key, entry] of this.byIp) {
      if (entry.lockedUntil <= now && this.expired(entry, now)) this.byIp.delete(key);
    }
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
