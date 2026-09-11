import { describe, expect, it } from 'vitest';
import { ProfileUpdater } from './profile-updater.js';
import { UserNotFoundError } from '../../domain/errors/user-not-found.error.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { USER_A, aUser } from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const ABSENT = '99999999-9999-4999-8999-999999999999';

function updaterFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new ProfileUpdater(scenario.userFinder, scenario.users, scenario.clock);
}

describe('ProfileUpdater', () => {
  it('changes the name of the person', async () => {
    const scenario = anAccessScenario({ users: [aUser()] });

    await updaterFor(scenario).run({ userId: USER_A, name: 'Ana Maria Rivas' });

    const user = await scenario.users.find(UserId.of(USER_A));
    expect(user!.toPrimitives().name).toBe('Ana Maria Rivas');
  });

  // Cambiar el nombre no puede tocar la contrasena ni el correo.
  it('leaves the rest of the account untouched', async () => {
    const scenario = anAccessScenario({ users: [aUser()] });
    const before = (await scenario.users.find(UserId.of(USER_A)))!.toPrimitives();

    await updaterFor(scenario).run({ userId: USER_A, name: 'Otro Nombre' });

    const after = (await scenario.users.find(UserId.of(USER_A)))!.toPrimitives();
    expect(after.email).toBe(before.email);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('rejects an empty name', async () => {
    const scenario = anAccessScenario({ users: [aUser()] });

    await expect(updaterFor(scenario).run({ userId: USER_A, name: '   ' })).rejects.toThrow(
      /cannot be empty/,
    );
  });

  it('rejects a user that does not exist', async () => {
    const scenario = anAccessScenario({ users: [aUser()] });

    await expect(updaterFor(scenario).run({ userId: ABSENT, name: 'Nadie' })).rejects.toThrow(
      UserNotFoundError,
    );
  });
});
