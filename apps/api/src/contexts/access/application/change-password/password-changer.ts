import { Clock } from '../../../../shared/domain/ports/clock.js';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error.js';
import { UserFinder } from '../../domain/user/find/user-finder.js';
import { PasswordHash } from '../../domain/user/password-hash.vo.js';
import { PasswordHasher } from '../../domain/user/password-hasher.js';
import { PlainPassword } from '../../domain/user/plain-password.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { UserRepository } from '../../domain/user/user.repository.js';

export class PasswordChanger {
  constructor(
    private readonly finder: UserFinder,
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async run(request: { userId: string; current: string; next: string }): Promise<void> {
    const user = await this.finder.find(UserId.of(request.userId));

    // Se exige la contrasena actual: si no, quien se siente ante una sesion abierta
    // podria cambiarla y dejar fuera a su dueno.
    const matches = await this.hasher.verify(request.current, user.currentPasswordHash().value);

    if (!matches) {
      throw new InvalidCredentialsError();
    }

    const next = PlainPassword.of(request.next);

    user.changePassword(PasswordHash.of(await this.hasher.hash(next.value)), this.clock.now());

    await this.users.save(user);
  }
}
