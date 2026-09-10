import { TenantId } from './tenant-id.vo.js';
import { TenantName } from './tenant-name.vo.js';
import { TenantSlug } from './tenant-slug.vo.js';

export interface TenantPrimitives {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Tenant {
  private constructor(
    readonly id: TenantId,
    private name: TenantName,
    private readonly slug: TenantSlug,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    id: TenantId,
    name: TenantName,
    slug: TenantSlug,
    now: Date,
  ): Tenant {
    return new Tenant(id, name, slug, true, now, now);
  }

  static fromPrimitives(row: TenantPrimitives): Tenant {
    return new Tenant(
      TenantId.of(row.id),
      TenantName.of(row.name),
      TenantSlug.of(row.slug),
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): TenantPrimitives {
    return {
      id: this.id.value,
      name: this.name.value,
      slug: this.slug.value,
      isActive: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  isActive(): boolean {
    return this.active;
  }

  rename(name: TenantName, now: Date): void {
    this.name = name;
    this.updatedAt = now;
  }

  // Suspender la empresa deja fuera a todos sus miembros de golpe: la regla la
  // aplica SignInPolicy, no cada caso de uso.
  suspend(now: Date): void {
    this.active = false;
    this.updatedAt = now;
  }

  activate(now: Date): void {
    this.active = true;
    this.updatedAt = now;
  }
}
