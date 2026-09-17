import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { SalesOrderLineInput, SalesOrderReferences } from '../../domain/order/lines/sales-order-references.js';
import { SalesOrder, SalesOrderDetails, SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { SalesCodeSequence, salesCode } from '../../domain/shared/code-sequence.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { DocumentRates, ensurePriceDecimals } from '../../../../shared/domain/ports/document-rates.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesOrderInput {
  currency?: string | null;
  exchangeRate?: number | null;
  customerId: string;
  warehouseId: string;
  date?: string | null;
  notes?: string | null;
  lines: SalesOrderLineInput[];
}

export interface SalesOrderCreatorRequest extends SalesOrderInput {
  tenantId: string;
}

// Lo que comparten crear, editar y confirmar: resolver lo que escribio la persona.
export async function salesOrderDetails(
  references: SalesOrderReferences,
  rates: DocumentRates,
  tenantId: TenantId,
  input: SalesOrderInput,
  today: string,
  keepsCurrency = false,
): Promise<SalesOrderDetails> {
  const orderDate = input.date ? SalesDate.of(input.date) : SalesDate.of(today);
  const resolved = {
    customerId: await references.customer(tenantId, input.customerId),
    warehouseId: await references.warehouse(tenantId, input.warehouseId),
    orderDate,
    notes: input.notes ?? null,
    lines: await references.lines(tenantId, input.lines),
  };

  orderDate.ensureNotAfter(today);
  await ensurePriceDecimals(rates, tenantId.value, input.lines.map((line) => line.unitPrice));

  const currency = await rates.forDocument(tenantId.value, {
    currency: input.currency,
    date: orderDate.value,
    manualRate: input.exchangeRate,
    keepsCurrency,
  });

  return { ...resolved, currency: DocumentCurrency.of(currency) };
}

// Crea un borrador: todavia no reserva nada.
export class SalesOrderCreator {
  constructor(
    private readonly references: SalesOrderReferences,
    private readonly orders: SalesOrderRepository,
    private readonly codes: SalesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: SalesOrderCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const details = await salesOrderDetails(this.references, this.rates, tenantId, request, today);
    const id = SalesOrderId.of(this.ids.next());

    // Se valida entero antes de pedir el numero: un pedido invalido no gasta correlativo.
    SalesOrder.draft(id, tenantId, salesCode('PED', 0), details, now, today);

    const code = salesCode('PED', await this.codes.next(tenantId, 'PED'));

    await this.orders.save(SalesOrder.draft(id, tenantId, code, details, now, today));
  }
}
