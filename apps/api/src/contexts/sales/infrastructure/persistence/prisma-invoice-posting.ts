import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { violatedUniqueFields } from '../../../../shared/prisma/unique-violation.js';
import { Dispatch, DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchAlreadyInvoicedError, InvoiceNotFoundError } from '../../domain/errors/sales.errors.js';
import { Invoice, InvoiceId } from '../../domain/invoice/invoice.entity.js';
import { InvoicePosting } from '../../domain/invoice/posting/invoice-posting.js';
import { SalesOrder } from '../../domain/order/sales-order.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, invoiceFromRow } from './sales-rows.js';
import { lockDispatch, lockOrder } from './prisma-sales-writer.js';

const ONE_ISSUED_PER_DISPATCH = 'invoices_one_issued_per_dispatch';

@Injectable()
export class PrismaInvoicePosting implements InvoicePosting {
  constructor(private readonly prisma: PrismaService) {}

  async issue(tenantId: TenantId, dispatchId: DispatchId, work: (dispatch: Dispatch, order: SalesOrder, alreadyInvoiced: boolean) => Invoice): Promise<void> {
    const tenant = tenantId.value;

    try {
      await this.prisma.$transaction(async (tx) => {
        const { dispatch, invoiced } = await lockDispatch(tx, tenant, dispatchId.value);
        const order = await lockOrder(tx, tenant, dispatch.orderId.value);
        const { lines, issueDate, dueDate, ...row } = work(dispatch, order, invoiced).toPrimitives();

        await tx.invoice.create({ data: { ...row, issueDate: asDate(issueDate), dueDate: asDate(dueDate) } });
        await tx.invoiceLine.createMany({ data: lines.map((line) => ({ ...line, tenantId: tenant, invoiceId: row.id })) });
      });
    } catch (error) {
      // El bloqueo ya pone en fila dos emisiones; el indice parcial es la ultima palabra.
      if (violatedUniqueFields(error)?.includes(ONE_ISSUED_PER_DISPATCH)) throw new DispatchAlreadyInvoicedError(dispatchId.value);

      throw error;
    }
  }

  async cancel(tenantId: TenantId, invoiceId: InvoiceId, work: (invoice: Invoice) => void): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM invoices WHERE tenant_id = ${tenant}::uuid AND id = ${invoiceId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new InvoiceNotFoundError(invoiceId.value);

      const invoice = invoiceFromRow(await tx.invoice.findFirstOrThrow({ where: { tenantId: tenant, id: invoiceId.value }, include: { lines: true } }));

      work(invoice);

      const { status, cancelledAt, updatedAt } = invoice.toPrimitives();

      await tx.invoice.update({ where: { tenantId_id: { tenantId: tenant, id: invoiceId.value } }, data: { status, cancelledAt, updatedAt } });
    });
  }
}
