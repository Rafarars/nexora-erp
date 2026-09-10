import { describe, expect, it } from 'vitest';
import { Email } from './email.vo.js';
import { User } from './user.entity.js';
import { UserName } from './user-name.vo.js';
import { NOW, USER_A, aUser } from '../testing/access.mother.js';

const LATER = new Date('2026-02-01T10:00:00.000Z');

describe('User', () => {
  it('is born active', () => {
    expect(aUser().isActive()).toBe(true);
  });

  it('survives a round trip through primitives', () => {
    const primitives = aUser().toPrimitives();

    expect(User.fromPrimitives(primitives).toPrimitives()).toEqual(primitives);
  });

  it('stamps the change date when the email changes', () => {
    const user = aUser();

    user.changeEmail(Email.of('nueva@acme.com'), LATER);

    expect(user.toPrimitives().email).toBe('nueva@acme.com');
    expect(user.toPrimitives().updatedAt).toEqual(LATER);
    expect(user.toPrimitives().createdAt).toEqual(NOW);
  });

  it('keeps its identity when its data changes', () => {
    const user = aUser();

    user.rename(UserName.of('Ana Maria'), LATER);

    expect(user.id.value).toBe(USER_A);
    expect(user.toPrimitives().name).toBe('Ana Maria');
  });

  it('can be deactivated and reactivated', () => {
    const user = aUser();

    user.deactivate(LATER);
    expect(user.isActive()).toBe(false);

    user.activate(LATER);
    expect(user.isActive()).toBe(true);
  });
});
