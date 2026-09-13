import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { CategoryName } from '../../domain/category/category-name.vo.js';
import { Category } from '../../domain/category/category.entity.js';
import { CategoryRepository } from '../../domain/category/category.repository.js';
import { DuplicateCategoryNameError } from '../../domain/errors/duplicate.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { violates } from '../../../../shared/prisma/unique-violation.js';

// Las fechas se escriben explicitas: el reloj es del dominio, y sin esto `@updatedAt`
// pondria la hora de la base y el contrato veria una entidad distinta de la guardada.
//
// El upsert busca por empresa E identificador, igual en todos los repositorios del
// catalogo: aunque llegara un identificador ajeno, nunca se sobrescribiria la fila de
// otra empresa; la base rechazaria el alta por clave primaria repetida.
@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(category: Category): Promise<void> {
    const { id, tenantId, code, name, description, isActive, createdAt, updatedAt } = category.toPrimitives();

    try {
      await this.prisma.category.upsert({
        where: { tenantId_id: { tenantId, id } },
        create: { id, tenantId, code, name, description, isActive, createdAt, updatedAt },
        update: { name, description, isActive, updatedAt },
      });
    } catch (error) {
      if (violates(error, 'name')) throw new DuplicateCategoryNameError(name, tenantId);
      throw error;
    }
  }

  async find(tenantId: TenantId, id: CategoryId): Promise<Category | null> {
    const row = await this.prisma.category.findFirst({ where: { id: id.value, tenantId: tenantId.value } });

    return row ? Category.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: CategoryName): Promise<Category | null> {
    const row = await this.prisma.category.findFirst({ where: { tenantId: tenantId.value, name: name.value } });

    return row ? Category.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({ where: { tenantId: tenantId.value }, orderBy: { name: 'asc' } });

    return rows.map((row) => Category.fromPrimitives(row));
  }
}
