import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates, ensurePriceDecimals } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { PurchaseOrderLineInput, PurchaseOrderReferences } from '../../domain/order/lines/purchase-order-references.js';
import { PurchaseOrder, PurchaseOrderDetails, PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { PurchasingCodeSequence, purchasingCode } from '../../domain/shared/code-sequence.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseOrderInput {
  supplierId: string;
  warehouseId: string;
  date?: string | null;
  expectedDate?: string | null;
  notes?: string | null;
  // Sin moneda, la de la empresa.
  currency?: string | null;
  // Vacia, la tasa del dia de la orden.
  exchangeRate?: number | null;
  lines: PurchaseOrderLineInput[];
}

export interface PurchaseOrderCreatorRequest extends PurchaseOrderInput {
  tenantId: string;
}

// Lo que comparten crear, editar y confirmar: resolver lo que escribio la persona.
export async function orderDetails(
  references: PurchaseOrderReferences,
  rates: DocumentRates,
  tenantId: TenantId,
  input: PurchaseOrderInput,
  today: string,
  keepsCurrency = false,
): Promise<PurchaseOrderDetails> {
  const orderDate = input.date ? PurchaseDate.of(input.date) : PurchaseDate.of(today);
  const supplier = await references.supplier(tenantId, input.supplierId);
  const resolved = {
    supplierId: supplier.id,
    paymentTermDays: supplier.paymentTermDays,
    warehouseId: await references.warehouse(tenantId, input.warehouseId),
    orderDate,
    expectedDate: input.expectedDate ? PurchaseDate.of(input.expectedDate) : null,
    notes: input.notes ?? null,
    lines: await references.lines(tenantId, input.lines),
  };

  // Las tasas al final y con la fecha ya validada: una orden futura no pregunta por ellas.
  orderDate.ensureNotAfter(today);
  await ensurePriceDecimals(rates, tenantId.value, input.lines.map((line) => line.unitCost));

  const currency = await rates.forDocument(tenantId.value, {
    currency: input.currency,
    date: orderDate.value,
    manualRate: input.exchangeRate,
    keepsCurrency,
  });

  return { ...resolved, currency: DocumentCurrency.of(currency) };
}

// Crea un borrador: todavia no anuncia nada en camino. La fecha, si no se da, es la de hoy; la
// moneda, la de la empresa; y la tasa, la de la fecha de la orden.
export class PurchaseOrderCreator {
  constructor(
    private readonly references: PurchaseOrderReferences,
    private readonly orders: PurchaseOrderRepository,
    private readonly codes: PurchasingCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: PurchaseOrderCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const details = await orderDetails(this.references, this.rates, tenantId, request, today);
    const id = PurchaseOrderId.of(this.ids.next());

    // Se valida entera antes de pedir el numero: una orden invalida no gasta correlativo.
    PurchaseOrder.draft(id, tenantId, purchasingCode('OC', 0), details, now, today);

    const code = purchasingCode('OC', await this.codes.next(tenantId, 'OC'));

    await this.orders.save(PurchaseOrder.draft(id, tenantId, code, details, now, today));
  }
}
