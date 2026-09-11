import { UserNotFoundError } from '../../errors/user-not-found.error.js';
import { UserId } from '../user-id.vo.js';
import { User } from '../user.entity.js';
import { UserRepository } from '../user.repository.js';

export class UserFinder {
  constructor(private readonly users: UserRepository) {}

  async find(id: UserId): Promise<User> {
    const user = await this.users.find(id);

    if (!user) {
      throw new UserNotFoundError(id.value);
    }

    return user;
  }
}
