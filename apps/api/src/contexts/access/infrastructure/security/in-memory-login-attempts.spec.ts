import { describe, expect, it } from 'vitest';
import { InMemoryLoginAttempts } from './in-memory-login-attempts.js';
import { Email } from '../../domain/user/email.vo.js';
import { NOW } from '../../domain/testing/access.mother.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';

const IP = '203.0.113.7';
const ANA = { email: Email.of('ana@acme.com'), ip: IP };
const from = (ip: string) => ({ email: Email.of('ana@acme.com'), ip });
const other = (address: string) => ({ email: Email.of(address), ip: IP });

function limiter() {
  const clock = new FixedClock(NOW);

  // 3 fallos por correo, 8 correos inexistentes por direccion: cada limite se prueba solo.
  return { clock, attempts: new InMemoryLoginAttempts(3, 8, 60, clock) };
}

// Una cuenta real: la persona se equivoca de contrasena.
async function fail(attempts: InMemoryLoginAttempts, times: number, attempt = ANA) {
  for (let i = 0; i < times; i++) await attempts.recordFailure(attempt, true);
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

  it('counts each email on its own', async () => {
    const { attempts } = limiter();
    await fail(attempts, 3);

    expect(await attempts.isLocked({ email: Email.of('beto@globex.com'), ip: 'otra' })).toBe(false);
  });

  // Contar SOLO por correo dejaba echar a cualquiera del sistema: bastaban cinco intentos
  // fallidos sabiendo su direccion de correo. Lo que frena la direccion de red es otra
  // cosa: el barrido de muchas cuentas.
  describe('counting accounts by address', () => {
    // Correos que NO existen: alguien adivinando a quien hay.
    const sweep = async (attempts: InMemoryLoginAttempts, accounts: number) => {
      for (let i = 0; i < accounts; i++) {
        await attempts.recordFailure(other(`persona${i}@acme.com`), false);
      }
    };

    it('locks an address that keeps guessing accounts that do not exist', async () => {
      const { attempts } = limiter();

      await sweep(attempts, 8);

      expect(await attempts.isLocked(other('otra-mas@acme.com'))).toBe(true);
    });

    // La razon de mirar solo las cuentas que no existen: una oficina entera sale por la
    // misma direccion, y equivocarse de contrasena es un despiste, no un ataque.
    it('never locks an address for failing on accounts that do exist', async () => {
      const { attempts } = limiter();

      for (let i = 0; i < 50; i++) {
        await attempts.recordFailure(other(`persona${i}@acme.com`), true);
      }

      expect(await attempts.isLocked(other('beto@globex.com'))).toBe(false);
    });

    // El companero sigue entrando desde SU sitio aunque hayan barrido desde otro.
    it('counts each address on its own', async () => {
      const { attempts } = limiter();

      await sweep(attempts, 8);

      expect(await attempts.isLocked(from('198.51.100.4'))).toBe(false);
    });

    // Acertar no deberia limpiarle el rastro a quien lleva rato barriendo cuentas ajenas
    // desde la misma direccion.
    it('a successful sign in clears the email but not the address', async () => {
      const { attempts } = limiter();
      await sweep(attempts, 8);

      await attempts.reset(ANA);

      expect(await attempts.isLocked(other('otra@acme.com'))).toBe(true);
    });
  });
});
