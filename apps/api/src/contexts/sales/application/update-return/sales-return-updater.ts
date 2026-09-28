import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { DispatchNotFoundError } from '../../domain/errors/sales.errors.js';
import { SalesReturnFinder } from '../../domain/return/find/sales-return-finder.js';
import {
  OriginlessSalesReturnLineInput,
  SalesReturnLineFactory,
  SalesReturnLineInput,
} from '../../domain/return/lines/sales-return-line-factory.js';
import { ReturnCondition, SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { SalesReturnRepository } from '../../domain/return/sales-return.repository.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesReturnUpdaterRequest {
  tenantId: string;
  returnId: string;
  date?: string | null;
  condition: ReturnCondition;
  reason?: string | null;
  notes?: string | null;
  lines: (SalesReturnLineInput | OriginlessSalesReturnLineInput)[];
}

export class SalesReturnUpdater {
  constructor(
    private readonly finder: SalesReturnFinder,
    private readonly dispatches: DispatchRepository,
    private readonly returns: SalesReturnRepository,
    private readonly factory: SalesReturnLineFactory,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: SalesReturnUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const returnEntity = await this.finder.find(tenantId, SalesReturnId.of(request.returnId));

    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const returnDate = request.date ? SalesDate.of(request.date) : SalesDate.of(today);

    let dispatchDate: SalesDate | null = null;
    let lines = returnEntity.lines().map((l) => l);

    if (returnEntity.dispatchId) {
      const dispatch = await this.dispatches.find(tenantId, returnEntity.dispatchId);
      if (!dispatch) throw new DispatchNotFoundError(returnEntity.dispatchId.value);
      dispatchDate = dispatch.date();

      const alreadyReturned = await this.returns.returnedQuantitiesByDispatch(tenantId, dispatch.id.value);
      lines = await this.factory.lines(tenantId, dispatch, request.lines as SalesReturnLineInput[], alreadyReturned);
    } else {
      lines = await this.factory.originlessLines(tenantId, returnEntity.warehouseId, request.lines as OriginlessSalesReturnLineInput[]);
    }

    returnEntity.update(
      {
        date: returnDate,
        condition: request.condition,
        reason: request.reason ?? null,
        notes: request.notes ?? null,
        lines: [...lines],
      },
      dispatchDate,
      now,
      today,
    );

    await this.returns.save(returnEntity);
  }
}
