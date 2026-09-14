import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { SalesOrderLineInput, SalesOrderReferences } from '../../domain/order/lines/sales-order-references.js';
import { SalesOrder, SalesOrderDetails, SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { SalesCodeSequence, salesCode } from '../../domain/shared/code-sequence.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesOrderInput {
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
  tenantId: TenantId,
  input: SalesOrderInput,
  now: Date,
): Promise<SalesOrderDetails> {
  return {
    customerId: await references.customer(tenantId, input.customerId),
    warehouseId: await references.warehouse(tenantId, input.warehouseId),
    orderDate: input.date ? SalesDate.of(input.date) : SalesDate.fromDate(now),
    notes: input.notes ?? null,
    lines: await references.lines(tenantId, input.lines),
  };
}

// Crea un borrador: todavia no reserva nada.
export class SalesOrderCreator {
  constructor(
    private readonly references: SalesOrderReferences,
    private readonly orders: SalesOrderRepository,
    private readonly codes: SalesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: SalesOrderCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const details = await salesOrderDetails(this.references, tenantId, request, now);
    const id = SalesOrderId.of(this.ids.next());

    // Se valida entero antes de pedir el numero: un pedido invalido no gasta correlativo.
    SalesOrder.draft(id, tenantId, salesCode('PED', 0), details, now);

    const code = salesCode('PED', await this.codes.next(tenantId, 'PED'));

    await this.orders.save(SalesOrder.draft(id, tenantId, code, details, now));
  }
}
