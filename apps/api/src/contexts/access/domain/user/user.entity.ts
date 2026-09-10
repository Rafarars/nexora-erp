import { Email } from './email.vo.js';
import { PasswordHash } from './password-hash.vo.js';
import { UserId } from './user-id.vo.js';
import { UserName } from './user-name.vo.js';

export interface UserPrimitives {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Una persona, no un empleado: no lleva tenantId. Lo que la ata a una empresa es
// una Membership, por eso el mismo correo sirve en varias empresas.
export class User {
  private constructor(
    readonly id: UserId,
    private email: Email,
    private passwordHash: PasswordHash,
    private name: UserName,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    id: UserId,
    email: Email,
    passwordHash: PasswordHash,
    name: UserName,
    now: Date,
  ): User {
    return new User(id, email, passwordHash, name, true, now, now);
  }

  static fromPrimitives(row: UserPrimitives): User {
    return new User(
      UserId.of(row.id),
      Email.of(row.email),
      PasswordHash.of(row.passwordHash),
      UserName.of(row.name),
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): UserPrimitives {
    return {
      id: this.id.value,
      email: this.email.value,
      passwordHash: this.passwordHash.value,
      name: this.name.value,
      isActive: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  emailAddress(): Email {
    return this.email;
  }

  currentPasswordHash(): PasswordHash {
    return this.passwordHash;
  }

  isActive(): boolean {
    return this.active;
  }

  changeEmail(email: Email, now: Date): void {
    this.email = email;
    this.updatedAt = now;
  }

  changePassword(passwordHash: PasswordHash, now: Date): void {
    this.passwordHash = passwordHash;
    this.updatedAt = now;
  }

  rename(name: UserName, now: Date): void {
    this.name = name;
    this.updatedAt = now;
  }

  deactivate(now: Date): void {
    this.active = false;
    this.updatedAt = now;
  }

  activate(now: Date): void {
    this.active = true;
    this.updatedAt = now;
  }
}
