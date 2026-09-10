import { TenantId } from '../tenant/tenant-id.vo.js';
import { UserId } from '../user/user-id.vo.js';
import { MembershipId } from './membership-id.vo.js';
import { Membership } from './membership.entity.js';

export const MEMBERSHIP_REPOSITORY = Symbol('MembershipRepository');

export interface MembershipRepository {
  save(membership: Membership): Promise<void>;
  find(tenantId: TenantId, id: MembershipId): Promise<Membership | null>;
  findByUser(tenantId: TenantId, userId: UserId): Promise<Membership | null>;
  searchByTenant(tenantId: TenantId): Promise<Membership[]>;
  // Las empresas a las que puede entrar una persona: alimenta el selector de empresa.
  searchByUser(userId: UserId): Promise<Membership[]>;
}
