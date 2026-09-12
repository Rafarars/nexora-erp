import { RoleId } from '../role/role-id.vo.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { UserId } from '../user/user-id.vo.js';
import { MembershipId } from './membership-id.vo.js';

export interface MembershipPrimitives {
  id: string;
  userId: string;
  tenantId: string;
  isActive: boolean;
  roleIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// La relacion entre una persona y una empresa. Los roles cuelgan de aqui y no del
// usuario: se puede ser administrador en una empresa y solo lectura en otra.
export class Membership {
  private constructor(
    readonly id: MembershipId,
    readonly userId: UserId,
    readonly tenantId: TenantId,
    private active: boolean,
    private roleIds: RoleId[],
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    id: MembershipId,
    userId: UserId,
    tenantId: TenantId,
    roleIds: RoleId[],
    now: Date,
  ): Membership {
    return new Membership(id, userId, tenantId, true, [...roleIds], now, now);
  }

  static fromPrimitives(row: MembershipPrimitives): Membership {
    return new Membership(
      MembershipId.of(row.id),
      UserId.of(row.userId),
      TenantId.of(row.tenantId),
      row.isActive,
      row.roleIds.map((id) => RoleId.of(id)),
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): MembershipPrimitives {
    return {
      id: this.id.value,
      userId: this.userId.value,
      tenantId: this.tenantId.value,
      isActive: this.active,
      roleIds: this.roleIds.map((id) => id.value),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  isActive(): boolean {
    return this.active;
  }

  roles(): RoleId[] {
    return [...this.roleIds];
  }

  hasRole(roleId: RoleId): boolean {
    return this.roleIds.some((assigned) => assigned.equals(roleId));
  }

  assignRole(roleId: RoleId, now: Date): void {
    if (this.hasRole(roleId)) {
      return;
    }

    this.roleIds = [...this.roleIds, roleId];
    this.updatedAt = now;
  }

  revokeRole(roleId: RoleId, now: Date): void {
    if (!this.hasRole(roleId)) {
      return;
    }

    this.roleIds = this.roleIds.filter((assigned) => !assigned.equals(roleId));
    this.updatedAt = now;
  }

  // Deja exactamente los roles indicados: la interfaz manda las casillas marcadas,
  // no una lista de cambios.
  replaceRoles(roleIds: RoleId[], now: Date): void {
    for (const current of this.roles()) {
      if (!roleIds.some((wanted) => wanted.equals(current))) {
        this.revokeRole(current, now);
      }
    }

    for (const wanted of roleIds) {
      this.assignRole(wanted, now);
    }
  }

  // Revocar el acceso a una empresa sin borrar la cuenta ni tocar las demas.
  revoke(now: Date): void {
    this.active = false;
    this.updatedAt = now;
  }

  restore(now: Date): void {
    this.active = true;
    this.updatedAt = now;
  }
}
