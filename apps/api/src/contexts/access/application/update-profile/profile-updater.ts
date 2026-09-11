import { Clock } from '../../../../shared/domain/ports/clock.js';
import { UserFinder } from '../../domain/user/find/user-finder.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { UserName } from '../../domain/user/user-name.vo.js';
import { UserRepository } from '../../domain/user/user.repository.js';

// Cada quien cambia lo suyo: el identificador sale de la sesion, nunca del cuerpo.
export class ProfileUpdater {
  constructor(
    private readonly finder: UserFinder,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: { userId: string; name: string }): Promise<void> {
    const user = await this.finder.find(UserId.of(request.userId));

    user.rename(UserName.of(request.name), this.clock.now());

    await this.users.save(user);
  }
}
