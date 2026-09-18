import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { SalesOrderLineInput, SalesOrderReferences } from '../../domain/order/lines/sales-order-references.js';
import { PriceListChoice } from '../../domain/order/pricing/price-list-choice.js';
import { SalesPricing, needsListRate } from '../../domain/order/pricing/sales-pricing.js';
import { PriceListRef } from '../../domain/shared/references.vo.js';
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
  // Con que lista se cotiza. Sin ella, la del cliente; sin esa, la de por defecto.
  priceListId?: string | null;
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
  choice: PriceListChoice,
  rates: DocumentRates,
  tenantId: TenantId,
  input: SalesOrderInput,
  today: string,
  keepsCurrency = false,
): Promise<SalesOrderDetails> {
  const orderDate = input.date ? SalesDate.of(input.date) : SalesDate.of(today);
  const customer = await references.customer(tenantId, input.customerId);
  const warehouseId = await references.warehouse(tenantId, input.warehouseId);

  orderDate.ensureNotAfter(today);
  await ensurePriceDecimals(rates, tenantId.value, written(input));

  // La moneda y la lista se resuelven antes que las lineas: el precio sugerido depende de las dos.
  const currency = await rates.forDocument(tenantId.value, {
    currency: input.currency,
    date: orderDate.value,
    manualRate: input.exchangeRate,
    keepsCurrency,
  });
  const priceList = await choice.resolve(tenantId, input.priceListId ? PriceListRef.of(input.priceListId) : null, customer.priceListId);
  const listRate = needsListRate(priceList, currency.currency) ? await rates.rateFor(tenantId.value, priceList!.currency, orderDate.value) : null;
  const pricing = new SalesPricing(priceList, listRate, currency, await rates.priceDecimals(tenantId.value));

  return {
    customerId: customer.id,
    warehouseId,
    orderDate,
    notes: input.notes ?? null,
    priceListId: pricing.priceListId(),
    lines: await references.lines(tenantId, input.lines, pricing),
    currency: DocumentCurrency.of(currency),
  };
}

// Solo los precios que escribio una persona se comprueban contra los decimales de la empresa: los
// de la lista ya salen redondeados.
function written(input: SalesOrderInput): number[] {
  return input.lines.map((line) => line.unitPrice).filter((price): price is number => price !== null && price !== undefined);
}

// Crea un borrador: todavia no reserva nada.
export class SalesOrderCreator {
  constructor(
    private readonly references: SalesOrderReferences,
    private readonly choice: PriceListChoice,
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
    const details = await salesOrderDetails(this.references, this.choice, this.rates, tenantId, request, today);
    const id = SalesOrderId.of(this.ids.next());

    // Se valida entero antes de pedir el numero: un pedido invalido no gasta correlativo.
    SalesOrder.draft(id, tenantId, salesCode('PED', 0), details, now, today);

    const code = salesCode('PED', await this.codes.next(tenantId, 'PED'));

    await this.orders.save(SalesOrder.draft(id, tenantId, code, details, now, today));
  }
}
