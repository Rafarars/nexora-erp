import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { PasswordHasher } from '../../domain/user/password-hasher.js';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  // Hash real de una contrasena que nadie conoce. Sin el, verificar contra un hash
  // vacio fallaba al instante y un correo inexistente respondia diez veces mas rapido
  // que uno registrado: el tiempo delataba que cuentas existen.
  private dummyHash: Promise<string> | null = null;

  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword);
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    const usable = passwordHash.startsWith('$argon2');
    const target = usable ? passwordHash : await this.dummy();

    try {
      const matches = await verify(target, plainPassword);

      // Contra el hash de relleno nunca se acepta, aunque alguien adivinara su clave.
      return usable && matches;
    } catch {
      return false;
    }
  }

  private dummy(): Promise<string> {
    this.dummyHash ??= hash(randomUUID());

    return this.dummyHash;
  }
}
