import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { CatalogCode } from './catalog-code.vo.js';
import { TenantId } from './tenant-id.vo.js';

export interface CatalogRecordPrimitives {
  id: string;
  tenantId: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Lo que comparten todos los maestros del catalogo. La politica de no borrado vive
// aqui: un registro se desactiva y se reactiva, pero ningun metodo lo hace desaparecer.
export abstract class CatalogRecord<Id extends Uuid> {
  protected constructor(
    readonly id: Id,
    readonly tenantId: TenantId,
    readonly code: CatalogCode,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  isActive(): boolean {
    return this.active;
  }

  deactivate(now: Date): void {
    this.active = false;
    this.touch(now);
  }

  activate(now: Date): void {
    this.active = true;
    this.touch(now);
  }

  protected touch(now: Date): void {
    this.updatedAt = now;
  }

  protected recordPrimitives(): CatalogRecordPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code.value,
      isActive: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
