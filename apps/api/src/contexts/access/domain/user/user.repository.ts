import { Email } from './email.vo.js';
import { UserId } from './user-id.vo.js';
import { User } from './user.entity.js';

export const USER_REPOSITORY = Symbol('UserRepository');

// Sin TenantId, y es intencionado: la persona no pertenece a una empresa. Para
// listar los usuarios DE una empresa se pasa por MembershipRepository.
export interface UserRepository {
  save(user: User): Promise<void>;
  find(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  searchByIds(ids: UserId[]): Promise<User[]>;
}
