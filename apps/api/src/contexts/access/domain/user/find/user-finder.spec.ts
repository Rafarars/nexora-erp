import { describe, expect, it } from 'vitest';
import { UserFinder } from './user-finder.js';
import { UserNotFoundError } from '../../errors/user-not-found.error.js';
import { USER_A, aUser } from '../../testing/access.mother.js';
import { InMemoryUserRepository } from '../../../infrastructure/testing/in-memory-user.repository.js';
import { UserId } from '../user-id.vo.js';

const ABSENT = '99999999-9999-4999-8999-999999999999';
const finder = new UserFinder(new InMemoryUserRepository([aUser()]));

describe('UserFinder', () => {
  it('returns the user when it exists', async () => {
    expect((await finder.find(UserId.of(USER_A))).id.value).toBe(USER_A);
  });

  it('throws when it does not', async () => {
    await expect(finder.find(UserId.of(ABSENT))).rejects.toThrow(UserNotFoundError);
  });
});
