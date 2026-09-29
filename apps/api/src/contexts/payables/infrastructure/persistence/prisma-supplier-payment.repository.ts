import { Injectable } from '@nestjs/common';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PaymentNotEditableError } from '../../domain/errors/payables.errors.js';
import { SupplierPayment, PaymentId } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentCriteria, SupplierPaymentPage, SupplierPaymentRepository } from '../../domain/payment/payment.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PAYMENT_INCLUDE, asDate, paymentFromRow } from './payables-rows.js';

@Injectable()
export class PrismaSupplierPaymentRepository implements SupplierPaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Solo borradores, y en la version en que se leyeron: si mientras se editaba alguien lo confirmo o
  // lo guardo, el pago bloqueado lo dice.
  async save(payment: SupplierPayment): Promise<void> {
    const { allocations, paymentDate, tenantId, id, ...row } = payment.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const [stored] = await tx.$queryRaw<{ status: string; updated_at: Date }[]>`
        SELECT status::text, updated_at FROM supplier_payments WHERE tenant_id = ${tenantId}::uuid AND id = ${id}::uuid FOR UPDATE`;

      if (stored && stored.status !== 'draft') throw new PaymentNotEditableError(id, stored.status);
      if (stored && stored.updated_at.getTime() !== payment.version()?.getTime()) throw new ConcurrentModificationError(id);

      const data = { ...row, paymentDate: asDate(paymentDate) };

      if (stored) {
        await tx.supplierPayment.update({ where: { tenantId_id: { tenantId, id } }, data: { ...data, code: undefined, createdAt: undefined } });
        await tx.supplierPaymentAllocation.deleteMany({ where: { tenantId, paymentId: id } });
      } else {
        await tx.supplierPayment.create({ data: { ...data, id, tenantId } });
      }

      await tx.supplierPaymentAllocation.createMany({ data: allocations.map((allocation) => ({ ...allocation, tenantId, paymentId: id })) });
    });
  }

  async find(tenantId: TenantId, id: PaymentId): Promise<SupplierPayment | null> {
    const row = await this.prisma.supplierPayment.findFirst({ where: { tenantId: tenantId.value, id: id.value }, include: PAYMENT_INCLUDE });

    return row ? paymentFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<SupplierPayment[]> {
    const rows = await this.prisma.supplierPayment.findMany({ where: { tenantId: tenantId.value }, include: PAYMENT_INCLUDE, orderBy: { code: 'desc' } });

    return rows.map(paymentFromRow);
  }

  async searchPage(tenantId: TenantId, criteria: SupplierPaymentCriteria): Promise<SupplierPaymentPage> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(criteria.supplierId ? { supplierId: criteria.supplierId } : {}),
      ...(criteria.status ? { status: criteria.status } : {}),
      ...(criteria.from || criteria.to
        ? { paymentDate: { ...(criteria.from ? { gte: asDate(criteria.from) } : {}), ...(criteria.to ? { lte: asDate(criteria.to) } : {}) } }
        : {}),
      ...(text
        ? {
            OR: [
              { code: { contains: text, mode: 'insensitive' as const } },
              { reference: { contains: text, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.supplierPayment.findMany({ where, include: PAYMENT_INCLUDE, orderBy: [{ code: 'desc' }, { id: 'asc' }], take: criteria.limit, skip: criteria.offset }),
      this.prisma.supplierPayment.count({ where }),
    ]);

    return { payments: rows.map(paymentFromRow), total };
  }
}
