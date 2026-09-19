import { describe, expect, it } from 'vitest';
import { InMemoryLoginAttempts } from './in-memory-login-attempts.js';
import { Email } from '../../domain/user/email.vo.js';
import { NOW } from '../../domain/testing/access.mother.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';

const ANA = Email.of('ana@acme.com');

function limiter() {
  const clock = new FixedClock(NOW);

  return { clock, attempts: new InMemoryLoginAttempts(3, 60, clock) };
}

async function fail(attempts: InMemoryLoginAttempts, times: number, email = ANA) {
  for (let i = 0; i < times; i++) await attempts.recordFailure(email);
}

describe('InMemoryLoginAttempts', () => {
  it('does not lock below the limit', async () => {
    const { attempts } = limiter();

    await fail(attempts, 2);

    expect(await attempts.isLocked(ANA)).toBe(false);
  });

  it('locks when the limit is reached', async () => {
    const { attempts } = limiter();

    await fail(attempts, 3);

    expect(await attempts.isLocked(ANA)).toBe(true);
  });

  it('unlocks once the lockout has passed', async () => {
    const { attempts, clock } = limiter();
    await fail(attempts, 3);

    clock.travelTo(new Date(NOW.getTime() + 61_000));

    expect(await attempts.isLocked(ANA)).toBe(false);
  });

  // Fallos espaciados no se acumulan para siempre.
  it('forgets old failures outside the window', async () => {
    const { attempts, clock } = limiter();
    await fail(attempts, 2);

    clock.travelTo(new Date(NOW.getTime() + 61_000));
    await fail(attempts, 1);

    expect(await attempts.isLocked(ANA)).toBe(false);
  });

  it('starts over after a successful sign in', async () => {
    const { attempts } = limiter();
    await fail(attempts, 2);

    await attempts.reset(ANA);
    await fail(attempts, 2);

    expect(await attempts.isLocked(ANA)).toBe(false);
  });

  // La ventana arranca de nuevo al bloquear. Con los fallos repartidos, el bloqueo acaba
  // mas tarde que la ventana vieja, y sin esto un fallo en ese hueco reiniciaba el contador
  // y levantaba el bloqueo antes de tiempo. Hoy el autenticador mira `isLocked` primero y
  // no llega a este camino, pero el puerto no obliga a ese orden.
  it('does not let a later failure lift the lock early', async () => {
    const { attempts, clock } = limiter();
    const at = (seconds: number) => clock.travelTo(new Date(NOW.getTime() + seconds * 1000));

    await fail(attempts, 1);
    at(50);
    await fail(attempts, 1);
    at(59);
    await fail(attempts, 1); // el tercero: bloquea hasta el segundo 119

    at(61); // fuera de la ventana vieja (0-60), dentro del bloqueo
    await fail(attempts, 1);

    expect(await attempts.isLocked(ANA)).toBe(true);
  });

  it('counts each email on its own', async () => {
    const { attempts } = limiter();
    await fail(attempts, 3);

    expect(await attempts.isLocked(Email.of('beto@globex.com'))).toBe(false);
  });
});
