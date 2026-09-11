import { MembershipId } from '../../domain/membership/membership-id.vo.js';
import { Membership } from '../../domain/membership/membership.entity.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly rows = new Map<string, ReturnType<Membership['toPrimitives']>>();

  constructor(seed: Membership[] = []) {
    seed.forEach((membership) => this.rows.set(membership.id.value, membership.toPrimitives()));
  }

  async save(membership: Membership): Promise<void> {
    this.rows.set(membership.id.value, membership.toPrimitives());
  }

  async find(tenantId: TenantId, id: MembershipId): Promise<Membership | null> {
    const row = this.rows.get(id.value);

    // El filtro por empresa se aplica aqui igual que lo hara el WHERE de Prisma: una
    // membresia de otra empresa no existe, no es un 403.
    if (!row || row.tenantId !== tenantId.value) {
      return null;
    }

    return Membership.fromPrimitives(row);
  }

  async findByUser(tenantId: TenantId, userId: UserId): Promise<Membership | null> {
    const row = [...this.rows.values()].find(
      (candidate) => candidate.tenantId === tenantId.value && candidate.userId === userId.value,
    );

    return row ? Membership.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Membership[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .map((row) => Membership.fromPrimitives(row));
  }

  async searchByUser(userId: UserId): Promise<Membership[]> {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId.value)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((row) => Membership.fromPrimitives(row));
  }
}
