import { Clock } from '../../../../shared/domain/ports/clock.js';
import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error.js';
import { WrongCurrentPasswordError } from '../../domain/errors/wrong-current-password.error.js';
import { Email } from '../../domain/user/email.vo.js';
import { UserFinder } from '../../domain/user/find/user-finder.js';
import { PasswordHasher } from '../../domain/user/password-hasher.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { UserRepository } from '../../domain/user/user.repository.js';

export interface EmailChangerRequest {
  userId: string;
  current: string;
  email: string;
}

// Cada quien cambia su propio correo, y solo confirmando la contrasena: el correo es la
// llave de la cuenta en TODAS sus empresas, asi que ningun administrador puede tocarlo.
export class EmailChanger {
  constructor(
    private readonly finder: UserFinder,
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async run(request: EmailChangerRequest): Promise<void> {
    const user = await this.finder.find(UserId.of(request.userId));

    // La contrasena va primero: sin ella, el 409 de un correo ocupado le diria a quien
    // encuentre una sesion abierta que correos estan registrados.
    const matches = await this.hasher.verify(request.current, user.currentPasswordHash().value);

    if (!matches) {
      throw new WrongCurrentPasswordError();
    }

    const email = Email.of(request.email);

    if (email.equals(user.emailAddress())) {
      return;
    }

    const owner = await this.users.findByEmail(email);

    if (owner && !owner.id.equals(user.id)) {
      throw new EmailAlreadyInUseError(email.value);
    }

    user.changeEmail(email, this.clock.now());

    await this.users.save(user);
  }
}
