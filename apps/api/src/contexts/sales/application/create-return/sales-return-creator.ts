import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import {
  CustomerNotFoundError,
  DispatchNotFoundError,
  DispatchNotReturnableError,
  ReturnCustomerMismatchError,
} from '../../domain/errors/sales.errors.js';
import { SalesReturnLineFactory, SalesReturnLineInput } from '../../domain/return/lines/sales-return-line-factory.js';
import { ReturnCondition, SalesReturn, SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { SalesReturnRepository } from '../../domain/return/sales-return.repository.js';
import { SalesCodeSequence, salesCode } from '../../domain/shared/code-sequence.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';

export interface SalesReturnInput {
  date?: string | null;
  condition: ReturnCondition;
  reason?: string | null;
  notes?: string | null;
  lines: SalesReturnLineInput[];
}

export interface SalesReturnCreatorRequest extends SalesReturnInput {
  tenantId: string;
  customerId: string;
  dispatchId: string;
}

export class SalesReturnCreator {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly dispatches: DispatchRepository,
    private readonly orders: SalesOrderFinder,
    private readonly returns: SalesReturnRepository,
    private readonly factory: SalesReturnLineFactory,
    private readonly codes: SalesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: SalesReturnCreatorRequest): Promise<string> {
    const tenantId = TenantId.of(request.tenantId);
    const customer = await this.customers.find(tenantId, CustomerId.of(request.customerId));
    if (!customer) throw new CustomerNotFoundError(request.customerId);

    const dispatch = await this.dispatches.find(tenantId, DispatchId.of(request.dispatchId));
    if (!dispatch) throw new DispatchNotFoundError(request.dispatchId);
    if (dispatch.currentStatus() !== 'confirmed') {
      throw new DispatchNotReturnableError(dispatch.id.value, dispatch.currentStatus());
    }

    const order = await this.orders.find(tenantId, dispatch.orderId);
    if (order.customerId().value !== customer.id.value) {
      throw new ReturnCustomerMismatchError(customer.id.value, order.customerId().value);
    }

    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const returnDate = request.date ? SalesDate.of(request.date) : SalesDate.of(today);

    const alreadyReturned = await this.returns.returnedQuantitiesByDispatch(tenantId, dispatch.id.value);
    const lines = await this.factory.lines(tenantId, dispatch, request.lines, alreadyReturned);

    const targetDispatch = { id: dispatch.id, warehouseId: dispatch.warehouseId, date: dispatch.date() };
    const details = {
      date: returnDate,
      condition: request.condition,
      reason: request.reason ?? null,
      notes: request.notes ?? null,
      lines,
    };

    const id = SalesReturnId.of(this.ids.next());
    const currency = order.currency();

    // Validacion inicial sin gastar correlativo
    SalesReturn.draft(id, tenantId, salesCode('DVV', 0), customer, targetDispatch, dispatch.warehouseId, currency, details, now, today);

    const code = salesCode('DVV', await this.codes.next(tenantId, 'DVV'));
    const returnEntity = SalesReturn.draft(id, tenantId, code, customer, targetDispatch, dispatch.warehouseId, currency, details, now, today);

    await this.returns.save(returnEntity);

    return returnEntity.id.value;
  }
}
