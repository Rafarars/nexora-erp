import { TenantId } from '../tenant/tenant-id.vo.js';
import { PermissionCode } from './permission-code.vo.js';
import { RoleId } from './role-id.vo.js';
import { RoleName } from './role-name.vo.js';

export interface RolePrimitives {
  id: string;
  tenantId: string;
  name: string;
  grantsAll: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Role {
  private constructor(
    readonly id: RoleId,
    readonly tenantId: TenantId,
    private name: RoleName,
    private readonly grantsAllPermissions: boolean,
    private permissions: PermissionCode[],
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    id: RoleId,
    tenantId: TenantId,
    name: RoleName,
    permissions: PermissionCode[],
    now: Date,
  ): Role {
    return new Role(id, tenantId, name, false, [...permissions], now, now);
  }

  // El rol de administrador no enumera permisos: los futuros quedan cubiertos sin
  // tener que actualizar una lista cada vez que nace uno.
  static createAdmin(id: RoleId, tenantId: TenantId, name: RoleName, now: Date): Role {
    return new Role(id, tenantId, name, true, [], now, now);
  }

  static fromPrimitives(row: RolePrimitives): Role {
    return new Role(
      RoleId.of(row.id),
      TenantId.of(row.tenantId),
      RoleName.of(row.name),
      row.grantsAll,
      row.permissions.map((code) => PermissionCode.of(code)),
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): RolePrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      name: this.name.value,
      grantsAll: this.grantsAllPermissions,
      permissions: this.permissions.map((code) => code.value),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // `grantsAll` concede todo DENTRO de su empresa: quien pregunta ya filtro por
  // tenant, y PermissionChecker lo verifica antes de llamar aqui.
  grants(permission: PermissionCode): boolean {
    if (this.grantsAllPermissions) {
      return true;
    }

    return this.permissions.some((granted) => granted.equals(permission));
  }

  grantsEverything(): boolean {
    return this.grantsAllPermissions;
  }

  belongsTo(tenantId: TenantId): boolean {
    return this.tenantId.equals(tenantId);
  }

  permissionCodes(): PermissionCode[] {
    return [...this.permissions];
  }

  rename(name: RoleName, now: Date): void {
    this.name = name;
    this.updatedAt = now;
  }

  grant(permission: PermissionCode, now: Date): void {
    if (this.permissions.some((granted) => granted.equals(permission))) {
      return;
    }

    this.permissions = [...this.permissions, permission];
    this.updatedAt = now;
  }

  revoke(permission: PermissionCode, now: Date): void {
    this.permissions = this.permissions.filter((granted) => !granted.equals(permission));
    this.updatedAt = now;
  }
}
