import { describe, expect, it } from 'vitest';
import { PasswordChanger } from './password-changer.js';
import { WrongCurrentPasswordError } from '../../domain/errors/wrong-current-password.error.js';
import { WeakPasswordError } from '../../domain/user/plain-password.vo.js';
import { PasswordHash } from '../../domain/user/password-hash.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { USER_A, aUser } from '../../domain/testing/access.mother.js';
import { FakePasswordHasher } from '../../infrastructure/testing/fake-password-hasher.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const CURRENT = 'the-current-password';

async function aScenarioWithPassword() {
  const user = aUser();
  user.changePassword(PasswordHash.of(await new FakePasswordHasher().hash(CURRENT)), new Date());

  return anAccessScenario({ users: [user] });
}

function changerFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new PasswordChanger(scenario.userFinder, scenario.users, scenario.hasher, scenario.clock);
}

describe('PasswordChanger', () => {
  it('replaces the password when the current one matches', async () => {
    const scenario = await aScenarioWithPassword();

    await changerFor(scenario).run({
      userId: USER_A,
      current: CURRENT,
      next: 'a-brand-new-password',
    });

    const stored = (await scenario.users.find(UserId.of(USER_A)))!.currentPasswordHash().value;
    expect(stored).toBe(await scenario.hasher.hash('a-brand-new-password'));
  });

  // Sin esto, quien se siente ante una sesion abierta podria dejar fuera a su dueno.
  it('rejects a wrong current password', async () => {
    const scenario = await aScenarioWithPassword();

    await expect(
      changerFor(scenario).run({ userId: USER_A, current: 'wrong', next: 'a-brand-new-password' }),
    ).rejects.toThrow(WrongCurrentPasswordError);
  });

  it('changes nothing when the current password is wrong', async () => {
    const scenario = await aScenarioWithPassword();
    const before = (await scenario.users.find(UserId.of(USER_A)))!.currentPasswordHash().value;

    await expect(
      changerFor(scenario).run({ userId: USER_A, current: 'wrong', next: 'a-brand-new-password' }),
    ).rejects.toThrow();

    const after = (await scenario.users.find(UserId.of(USER_A)))!.currentPasswordHash().value;
    expect(after).toBe(before);
  });

  it('rejects a new password that is too short', async () => {
    const scenario = await aScenarioWithPassword();

    await expect(
      changerFor(scenario).run({ userId: USER_A, current: CURRENT, next: 'short' }),
    ).rejects.toThrow(WeakPasswordError);
  });
});
