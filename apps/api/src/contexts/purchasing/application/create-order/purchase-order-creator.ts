import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { PurchaseOrderLineInput, PurchaseOrderReferences } from '../../domain/order/lines/purchase-order-references.js';
import { PurchaseOrder, PurchaseOrderDetails, PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { PurchasingCodeSequence, purchasingCode } from '../../domain/shared/code-sequence.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseOrderInput {
  supplierId: string;
  warehouseId: string;
  date?: string | null;
  expectedDate?: string | null;
  notes?: string | null;
  lines: PurchaseOrderLineInput[];
}

export interface PurchaseOrderCreatorRequest extends PurchaseOrderInput {
  tenantId: string;
}

// Lo que comparten crear, editar y confirmar: resolver lo que escribio la persona.
export async function orderDetails(
  references: PurchaseOrderReferences,
  tenantId: TenantId,
  input: PurchaseOrderInput,
  today: string,
): Promise<PurchaseOrderDetails> {
  return {
    supplierId: await references.supplier(tenantId, input.supplierId),
    warehouseId: await references.warehouse(tenantId, input.warehouseId),
    orderDate: input.date ? PurchaseDate.of(input.date) : PurchaseDate.of(today),
    expectedDate: input.expectedDate ? PurchaseDate.of(input.expectedDate) : null,
    notes: input.notes ?? null,
    lines: await references.lines(tenantId, input.lines),
  };
}

// Crea un borrador: todavia no anuncia nada en camino. La fecha, si no se da, es la de hoy.
export class PurchaseOrderCreator {
  constructor(
    private readonly references: PurchaseOrderReferences,
    private readonly orders: PurchaseOrderRepository,
    private readonly codes: PurchasingCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: PurchaseOrderCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const details = await orderDetails(this.references, tenantId, request, today);
    const id = PurchaseOrderId.of(this.ids.next());

    // Se valida entera antes de pedir el numero: una orden invalida no gasta correlativo.
    PurchaseOrder.draft(id, tenantId, purchasingCode('OC', 0), details, now, today);

    const code = purchasingCode('OC', await this.codes.next(tenantId, 'OC'));

    await this.orders.save(PurchaseOrder.draft(id, tenantId, code, details, now, today));
  }
}
