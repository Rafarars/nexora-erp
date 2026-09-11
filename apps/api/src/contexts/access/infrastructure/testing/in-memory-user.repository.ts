import { Email } from '../../domain/user/email.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { User } from '../../domain/user/user.entity.js';
import { UserRepository } from '../../domain/user/user.repository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, ReturnType<User['toPrimitives']>>();

  constructor(seed: User[] = []) {
    seed.forEach((user) => this.rows.set(user.id.value, user.toPrimitives()));
  }

  async save(user: User): Promise<void> {
    this.rows.set(user.id.value, user.toPrimitives());
  }

  async find(id: UserId): Promise<User | null> {
    const row = this.rows.get(id.value);

    return row ? User.fromPrimitives(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = [...this.rows.values()].find((candidate) => candidate.email === email.value);

    return row ? User.fromPrimitives(row) : null;
  }

  async searchByIds(ids: UserId[]): Promise<User[]> {
    return ids
      .map((id) => this.rows.get(id.value))
      .filter((row) => row !== undefined)
      .map((row) => User.fromPrimitives(row));
  }
}
