import { PasswordHasher } from '../../domain/user/password-hasher.js';

// Doble deliberadamente tonto: las pruebas de aplicacion comprueban el flujo, no la
// criptografia. Argon2 real tarda cientos de milisegundos por diseno.
export class FakePasswordHasher implements PasswordHasher {
  constructor(private readonly prefix = '$fake$v=1$') {}

  async hash(plainPassword: string): Promise<string> {
    return `${this.prefix}${plainPassword}${'='.repeat(16)}`;
  }

  async verify(plainPassword: string, hash: string): Promise<boolean> {
    return hash === (await this.hash(plainPassword));
  }
}
