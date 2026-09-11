import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { PasswordHasher } from '../../domain/user/password-hasher.js';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword);
  }

  // Un hash corrupto o de otro algoritmo hace que la libreria lance; para quien
  // pregunta eso es lo mismo que "no coincide", y nunca un error 500.
  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plainPassword);
    } catch {
      return false;
    }
  }
}
