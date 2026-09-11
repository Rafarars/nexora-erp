import { Clock } from '../../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { Email } from '../email.vo.js';
import { PasswordHash } from '../password-hash.vo.js';
import { PasswordHasher } from '../password-hasher.js';
import { UserId } from '../user-id.vo.js';
import { UserName } from '../user-name.vo.js';
import { User } from '../user.entity.js';
import { UserRepository } from '../user.repository.js';

// Una persona con un correo existe UNA vez en todo el sistema: si ya trabaja en otra
// empresa se reutiliza. Es la razon por la que `users` no lleva tenantId.
export class UserRegistrar {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async register(email: Email, password: string, name: UserName): Promise<User> {
    const existing = await this.users.findByEmail(email);

    if (existing) {
      return existing;
    }

    const user = User.create(
      UserId.of(this.ids.next()),
      email,
      PasswordHash.of(await this.hasher.hash(password)),
      name,
      this.clock.now(),
    );

    await this.users.save(user);

    return user;
  }
}
