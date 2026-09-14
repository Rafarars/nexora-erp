import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { RECEIVABLE_BALANCES } from '../../../../shared/prisma/receivable-balances.js';
import type { ReceivableBalances } from '../../../../shared/prisma/receivable-balances.js';
import { violatedUniqueFields } from '../../../../shared/prisma/unique-violation.js';
import { CustomerId } from '../../domain/customer/customer.entity.js';
import { Dispatch, DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { CustomerNotFoundError, DispatchAlreadyInvoicedError, InvoiceNotFoundError } from '../../domain/errors/sales.errors.js';
import { CustomerCredit } from '../../domain/invoice/credit/customer-credit.js';
import { Invoice, InvoiceId } from '../../domain/invoice/invoice.entity.js';
import { InvoicePosting } from '../../domain/invoice/posting/invoice-posting.js';
import { SalesOrder } from '../../domain/order/sales-order.entity.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, invoiceFromRow } from './sales-rows.js';
import { lockDispatch, lockOrder } from './prisma-sales-writer.js';

const ONE_ISSUED_PER_DISPATCH = 'invoices_one_issued_per_dispatch';

@Injectable()
export class PrismaInvoicePosting implements InvoicePosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RECEIVABLE_BALANCES) private readonly balances: ReceivableBalances,
  ) {}

  async credit(tenantId: TenantId, customerId: CustomerId, today: SalesDate): Promise<CustomerCredit> {
    return this.creditOf(this.prisma, tenantId.value, customerId.value, today.value, false);
  }

  async issue(
    tenantId: TenantId,
    dispatchId: DispatchId,
    today: SalesDate,
    work: (dispatch: Dispatch, order: SalesOrder, alreadyInvoiced: boolean, credit: CustomerCredit) => Invoice,
  ): Promise<void> {
    const tenant = tenantId.value;

    try {
      await this.prisma.$transaction(async (tx) => {
        const { dispatch, invoiced } = await lockDispatch(tx, tenant, dispatchId.value);
        const order = await lockOrder(tx, tenant, dispatch.orderId.value);
        const credit = await this.creditOf(tx, tenant, order.customerId().value, today.value, true);
        const { lines, issueDate, dueDate, ...row } = work(dispatch, order, invoiced, credit).toPrimitives();

        await tx.invoice.create({ data: { ...row, issueDate: asDate(issueDate), dueDate: asDate(dueDate) } });
        await tx.invoiceLine.createMany({ data: lines.map((line) => ({ ...line, tenantId: tenant, invoiceId: row.id })) });
      });
    } catch (error) {
      // El bloqueo ya pone en fila dos emisiones; el indice parcial es la ultima palabra.
      if (violatedUniqueFields(error)?.includes(ONE_ISSUED_PER_DISPATCH)) throw new DispatchAlreadyInvoicedError(dispatchId.value);

      throw error;
    }
  }

  async cancel(tenantId: TenantId, invoiceId: InvoiceId, work: (invoice: Invoice, paid: number) => void): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM invoices WHERE tenant_id = ${tenant}::uuid AND id = ${invoiceId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new InvoiceNotFoundError(invoiceId.value);

      const invoice = invoiceFromRow(await tx.invoice.findFirstOrThrow({ where: { tenantId: tenant, id: invoiceId.value }, include: { lines: true } }));

      // Un cobro que se confirma bloquea sus facturas: con esta bloqueada, lo cobrado no cambia.
      work(invoice, await this.balances.paidOf(tx, tenant, invoiceId.value));

      const { status, cancelledAt, updatedAt } = invoice.toPrimitives();

      await tx.invoice.update({ where: { tenantId_id: { tenantId: tenant, id: invoiceId.value } }, data: { status, cancelledAt, updatedAt } });
    });
  }

  private async creditOf(db: TransactionClient, tenantId: string, customerId: string, today: string, lock: boolean): Promise<CustomerCredit> {
    const exposure = lock ? await this.balances.lockCustomer(db, tenantId, customerId, today) : await this.balances.exposure(db, tenantId, customerId, today);
    const customer = await db.customer.findFirst({ where: { tenantId, id: customerId }, select: { paymentTermDays: true, creditLimit: true } });

    if (!customer) throw new CustomerNotFoundError(customerId);

    return {
      customerId,
      paymentTermDays: customer.paymentTermDays,
      creditLimit: customer.creditLimit === null ? null : customer.creditLimit.toNumber(),
      ...exposure,
    };
  }
}
