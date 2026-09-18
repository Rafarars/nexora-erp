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
import { SalesOrder, SalesOrderId } from '../../domain/order/sales-order.entity.js';
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

  async credit(tenantId: TenantId, customerId: CustomerId, today: SalesDate, decimals: number): Promise<CustomerCredit> {
    return this.creditOf(this.prisma, tenantId.value, customerId.value, today.value, decimals, false);
  }

  async issue(
    tenantId: TenantId,
    origin: { dispatchId?: DispatchId; orderId?: SalesOrderId },
    today: SalesDate,
    decimals: number,
    work: (dispatch: Dispatch | null, order: SalesOrder, alreadyInvoiced: boolean, credit: CustomerCredit) => Invoice,
  ): Promise<void> {
    const tenant = tenantId.value;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Con despacho se bloquea el, y su pedido detras; sin el, el pedido directamente.
        const locked = origin.dispatchId ? await lockDispatch(tx, tenant, origin.dispatchId.value) : null;
        const order = await lockOrder(tx, tenant, locked ? locked.dispatch.orderId.value : origin.orderId!.value);
        const credit = await this.creditOf(tx, tenant, order.customerId().value, today.value, decimals, true);
        const { lines, issueDate, dueDate, ...row } = work(locked?.dispatch ?? null, order, locked?.invoiced ?? false, credit).toPrimitives();

        await tx.invoice.create({ data: { ...row, issueDate: asDate(issueDate), dueDate: asDate(dueDate) } });
        await tx.invoiceLine.createMany({ data: lines.map((line) => ({ ...line, tenantId: tenant, invoiceId: row.id })) });

        // Emitir consume saldo del pedido: lo facturado sube en cada linea que entro a la factura.
        for (const line of order.toPrimitives().lines) {
          await tx.salesOrderLine.update({
            where: { tenantId_id: { tenantId: tenant, id: line.id } },
            data: { invoicedQuantity: line.invoicedQuantity },
          });
        }
      });
    } catch (error) {
      // El bloqueo ya pone en fila dos emisiones; el indice parcial es la ultima palabra.
      if (violatedUniqueFields(error)?.includes(ONE_ISSUED_PER_DISPATCH) && origin.dispatchId) {
        throw new DispatchAlreadyInvoicedError(origin.dispatchId.value);
      }

      throw error;
    }
  }

  async cancel(tenantId: TenantId, invoiceId: InvoiceId, work: (invoice: Invoice, order: SalesOrder, paid: number) => void): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM invoices WHERE tenant_id = ${tenant}::uuid AND id = ${invoiceId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new InvoiceNotFoundError(invoiceId.value);

      const invoice = invoiceFromRow(await tx.invoice.findFirstOrThrow({ where: { tenantId: tenant, id: invoiceId.value }, include: { lines: true } }));
      // Devolver lo facturado exige el pedido bloqueado, detras de la factura.
      const order = await lockOrder(tx, tenant, invoice.orderId().value);

      // Un cobro que se confirma bloquea sus facturas: con esta bloqueada, lo cobrado no cambia.
      work(invoice, order, await this.balances.paidOf(tx, tenant, invoiceId.value));

      const { status, cancelledAt, updatedAt } = invoice.toPrimitives();

      await tx.invoice.update({ where: { tenantId_id: { tenantId: tenant, id: invoiceId.value } }, data: { status, cancelledAt, updatedAt } });

      for (const line of order.toPrimitives().lines) {
        await tx.salesOrderLine.update({
          where: { tenantId_id: { tenantId: tenant, id: line.id } },
          data: { invoicedQuantity: line.invoicedQuantity },
        });
      }
    });
  }

  private async creditOf(db: TransactionClient, tenantId: string, customerId: string, today: string, decimals: number, lock: boolean): Promise<CustomerCredit> {
    const exposure = lock ? await this.balances.lockCustomer(db, tenantId, customerId, today, decimals) : await this.balances.exposure(db, tenantId, customerId, today, decimals);
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
