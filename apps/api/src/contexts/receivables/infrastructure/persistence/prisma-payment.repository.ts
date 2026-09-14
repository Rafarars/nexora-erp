import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PaymentNotEditableError } from '../../domain/errors/receivables.errors.js';
import { CustomerPayment, PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PAYMENT_INCLUDE, asDate, paymentFromRow } from './receivables-rows.js';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Solo borradores: si mientras se editaba alguien lo confirmo, el cobro bloqueado lo dice.
  async save(payment: CustomerPayment): Promise<void> {
    const { allocations, paymentDate, tenantId, id, ...row } = payment.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const [stored] = await tx.$queryRaw<{ status: string }[]>`
        SELECT status::text FROM customer_payments WHERE tenant_id = ${tenantId}::uuid AND id = ${id}::uuid FOR UPDATE`;

      if (stored && stored.status !== 'draft') throw new PaymentNotEditableError(id, stored.status);

      const data = { ...row, paymentDate: asDate(paymentDate) };

      if (stored) {
        await tx.customerPayment.update({ where: { tenantId_id: { tenantId, id } }, data: { ...data, code: undefined, createdAt: undefined } });
        await tx.paymentAllocation.deleteMany({ where: { tenantId, paymentId: id } });
      } else {
        await tx.customerPayment.create({ data: { ...data, id, tenantId } });
      }

      await tx.paymentAllocation.createMany({ data: allocations.map((allocation) => ({ ...allocation, tenantId, paymentId: id })) });
    });
  }

  async find(tenantId: TenantId, id: PaymentId): Promise<CustomerPayment | null> {
    const row = await this.prisma.customerPayment.findFirst({ where: { tenantId: tenantId.value, id: id.value }, include: PAYMENT_INCLUDE });

    return row ? paymentFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<CustomerPayment[]> {
    const rows = await this.prisma.customerPayment.findMany({ where: { tenantId: tenantId.value }, include: PAYMENT_INCLUDE, orderBy: { code: 'desc' } });

    return rows.map(paymentFromRow);
  }
}
