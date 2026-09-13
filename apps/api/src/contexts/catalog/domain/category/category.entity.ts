import { CatalogCode, CodePrefix } from '../shared/catalog-code.vo.js';
import { CatalogRecord, CatalogRecordPrimitives } from '../shared/catalog-record.js';
import { optionalText } from '../shared/bounded-text.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { CategoryId } from './category-id.vo.js';
import { CategoryName } from './category-name.vo.js';

export interface CategoryPrimitives extends CatalogRecordPrimitives {
  name: string;
  description: string | null;
}

const DESCRIPTION_MAX = 1000;

// Un solo nivel a proposito: una jerarquia de categorias complica cada filtro y cada
// reporte, y el catalogo de un ERP pequeno no la necesita.
export class Category extends CatalogRecord<CategoryId> {
  static readonly CODE_PREFIX: CodePrefix = 'CAT';

  private constructor(
    id: CategoryId,
    tenantId: TenantId,
    code: CatalogCode,
    private name: CategoryName,
    private description: string | null,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, tenantId, code, active, createdAt, updatedAt);
  }

  static create(
    id: CategoryId,
    tenantId: TenantId,
    code: CatalogCode,
    name: CategoryName,
    description: string | null,
    now: Date,
  ): Category {
    return new Category(
      id,
      tenantId,
      code,
      name,
      optionalText(description, DESCRIPTION_MAX, 'CategoryDescription'),
      true,
      now,
      now,
    );
  }

  static fromPrimitives(row: CategoryPrimitives): Category {
    return new Category(
      CategoryId.of(row.id),
      TenantId.of(row.tenantId),
      CatalogCode.of(row.code),
      CategoryName.of(row.name),
      row.description,
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): CategoryPrimitives {
    return { ...this.recordPrimitives(), name: this.name.value, description: this.description };
  }

  update(name: CategoryName, description: string | null, now: Date): void {
    this.name = name;
    this.description = optionalText(description, DESCRIPTION_MAX, 'CategoryDescription');
    this.touch(now);
  }
}
