export const PASSWORD_HASHER = Symbol('PasswordHasher');

// El dominio necesita comparar contrasenas, no saber con que algoritmo. Argon2 vive
// en el adaptador; cambiarlo no toca ni el dominio ni los casos de uso.
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, hash: string): Promise<boolean>;
}
