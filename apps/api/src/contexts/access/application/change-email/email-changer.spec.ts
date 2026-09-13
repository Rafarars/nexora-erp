import { describe, expect, it } from 'vitest';
import { EmailChanger } from './email-changer.js';
import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error.js';
import { WrongCurrentPasswordError } from '../../domain/errors/wrong-current-password.error.js';
import { InvalidEmailError } from '../../domain/user/email.vo.js';
import { PasswordHash } from '../../domain/user/password-hash.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { NOW, USER_A, aUser } from '../../domain/testing/access.mother.js';
import { FakePasswordHasher } from '../../infrastructure/testing/fake-password-hasher.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const CURRENT = 'the-current-password';
const USER_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function aScenario() {
  const user = aUser();
  user.changePassword(PasswordHash.of(await new FakePasswordHasher().hash(CURRENT)), NOW);

  return anAccessScenario({ users: [user, aUser({ id: USER_B, email: 'beto@globex.com' })] });
}

function changerFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new EmailChanger(scenario.userFinder, scenario.users, scenario.hasher, scenario.clock);
}

async function emailOf(scenario: ReturnType<typeof anAccessScenario>): Promise<string> {
  return (await scenario.users.find(UserId.of(USER_A)))!.emailAddress().value;
}

describe('EmailChanger', () => {
  it('changes the email when the current password matches', async () => {
    const scenario = await aScenario();

    await changerFor(scenario).run({ userId: USER_A, current: CURRENT, email: 'nueva@acme.com' });

    expect(await emailOf(scenario)).toBe('nueva@acme.com');
  });

  it('normalizes the new email like any other', async () => {
    const scenario = await aScenario();

    await changerFor(scenario).run({ userId: USER_A, current: CURRENT, email: '  Nueva@ACME.com ' });

    expect(await emailOf(scenario)).toBe('nueva@acme.com');
  });

  it('refuses without the current password and changes nothing', async () => {
    const scenario = await aScenario();

    await expect(
      changerFor(scenario).run({ userId: USER_A, current: 'wrong', email: 'nueva@acme.com' }),
    ).rejects.toThrow(WrongCurrentPasswordError);

    expect(await emailOf(scenario)).toBe('ana@acme.com');
  });

  // El correo es unico en todo el sistema: dos cuentas no pueden compartirlo.
  it('refuses an email that another person already uses', async () => {
    const scenario = await aScenario();

    await expect(
      changerFor(scenario).run({ userId: USER_A, current: CURRENT, email: 'beto@globex.com' }),
    ).rejects.toThrow(EmailAlreadyInUseError);
  });

  // Sin la contrasena no se puede averiguar si un correo esta ocupado.
  it('does not reveal a taken email to someone without the password', async () => {
    const scenario = await aScenario();

    await expect(
      changerFor(scenario).run({ userId: USER_A, current: 'wrong', email: 'beto@globex.com' }),
    ).rejects.toThrow(WrongCurrentPasswordError);
  });

  it('accepts keeping the same email', async () => {
    const scenario = await aScenario();

    await expect(
      changerFor(scenario).run({ userId: USER_A, current: CURRENT, email: 'ANA@acme.com' }),
    ).resolves.toBeUndefined();
  });

  it('rejects something that is not an email', async () => {
    const scenario = await aScenario();

    await expect(
      changerFor(scenario).run({ userId: USER_A, current: CURRENT, email: 'no-es-un-correo' }),
    ).rejects.toThrow(InvalidEmailError);
  });
});
