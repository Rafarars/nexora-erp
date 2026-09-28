import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
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
  SalesWarehouseNotFoundError,
} from '../../domain/errors/sales.errors.js';
import {
  OriginlessSalesReturnLineInput,
  SalesReturnLineFactory,
  SalesReturnLineInput,
} from '../../domain/return/lines/sales-return-line-factory.js';
import { SalesReturnLine } from '../../domain/return/sales-return-line.js';
import { ReturnCondition, SalesReturn, SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { SalesReturnRepository } from '../../domain/return/sales-return.repository.js';
import { SalesCodeSequence, salesCode } from '../../domain/shared/code-sequence.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';

export interface SalesReturnInput {
  date?: string | null;
  condition: ReturnCondition;
  reason?: string | null;
  notes?: string | null;
  lines: (SalesReturnLineInput | OriginlessSalesReturnLineInput)[];
}

export interface SalesReturnCreatorRequest extends SalesReturnInput {
  tenantId: string;
  customerId: string;
  dispatchId?: string | null;
  warehouseId?: string | null;
  currency?: string | null;
  exchangeRate?: number | null;
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
    private readonly rates?: DocumentRates,
  ) {}

  async run(request: SalesReturnCreatorRequest): Promise<string> {
    const tenantId = TenantId.of(request.tenantId);
    const customer = await this.customers.find(tenantId, CustomerId.of(request.customerId));
    if (!customer) throw new CustomerNotFoundError(request.customerId);

    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const returnDate = request.date ? SalesDate.of(request.date) : SalesDate.of(today);

    let currency: DocumentCurrency;
    let targetDispatch: { id: DispatchId; warehouseId: WarehouseRef; date: SalesDate } | null = null;
    let warehouseId: WarehouseRef;
    let lines: SalesReturnLine[];

    if (request.dispatchId) {
      const dispatch = await this.dispatches.find(tenantId, DispatchId.of(request.dispatchId));
      if (!dispatch) throw new DispatchNotFoundError(request.dispatchId);
      if (dispatch.currentStatus() !== 'confirmed') {
        throw new DispatchNotReturnableError(dispatch.id.value, dispatch.currentStatus());
      }

      const order = await this.orders.find(tenantId, dispatch.orderId);
      if (order.customerId().value !== customer.id.value) {
        throw new ReturnCustomerMismatchError(customer.id.value, order.customerId().value);
      }

      const alreadyReturned = await this.returns.returnedQuantitiesByDispatch(tenantId, dispatch.id.value);
      lines = await this.factory.lines(tenantId, dispatch, request.lines as SalesReturnLineInput[], alreadyReturned);

      targetDispatch = { id: dispatch.id, warehouseId: dispatch.warehouseId, date: dispatch.date() };
      warehouseId = dispatch.warehouseId;
      currency = order.currency();
    } else {
      if (!request.warehouseId) {
        throw new SalesWarehouseNotFoundError('');
      }
      warehouseId = WarehouseRef.of(request.warehouseId);
      lines = await this.factory.originlessLines(tenantId, warehouseId, request.lines as OriginlessSalesReturnLineInput[]);

      if (this.rates) {
        currency = DocumentCurrency.of(
          await this.rates.forDocument(tenantId.value, {
            currency: request.currency ?? null,
            date: returnDate.value,
            manualRate: request.exchangeRate ?? null,
          }),
        );
      } else {
        currency = DocumentCurrency.fromPrimitives({
          currency: request.currency ?? 'USD',
          exchangeRate: request.exchangeRate ?? null,
          baseCurrency: 'USD',
          baseExchangeRate: null,
          manualExchangeRate: false,
        });
      }
    }

    const details = {
      date: returnDate,
      condition: request.condition,
      reason: request.reason ?? null,
      notes: request.notes ?? null,
      lines,
    };

    const id = SalesReturnId.of(this.ids.next());

    // Validacion inicial sin gastar correlativo
    SalesReturn.draft(id, tenantId, salesCode('DVV', 0), customer, targetDispatch, warehouseId, currency, details, now, today);

    const code = salesCode('DVV', await this.codes.next(tenantId, 'DVV'));
    const returnEntity = SalesReturn.draft(id, tenantId, code, customer, targetDispatch, warehouseId, currency, details, now, today);

    await this.returns.save(returnEntity);

    return returnEntity.id.value;
  }
}
