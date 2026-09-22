import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchFinder } from '../../domain/dispatch/find/dispatch-finder.js';
import { SalesReturnRepository } from '../../domain/return/sales-return.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface DispatchLineQuotaResponse {
  dispatchLineId: string;
  itemId: string;
  dispatchedQuantity: number;
  alreadyReturnedQuantity: number;
  availableToReturnQuantity: number;
}

export interface DispatchReturnQuotaResponse {
  dispatchId: string;
  lines: DispatchLineQuotaResponse[];
}

export class DispatchReturnQuotaFinder {
  constructor(
    private readonly dispatches: DispatchFinder,
    private readonly returns: SalesReturnRepository,
  ) {}

  async run(tenantIdStr: string, dispatchIdStr: string): Promise<DispatchReturnQuotaResponse> {
    const tenantId = TenantId.of(tenantIdStr);
    const dispatch = await this.dispatches.find(tenantId, DispatchId.of(dispatchIdStr));

    const alreadyReturned = await this.returns.returnedQuantitiesByDispatch(tenantId, dispatch.id.value);

    const lines: DispatchLineQuotaResponse[] = dispatch.lines().map((line) => {
      const dispatched = line.quantity.toNumber();
      const returned = alreadyReturned.get(line.id.value) ?? 0;
      const available = Math.max(0, dispatched - returned);

      return {
        dispatchLineId: line.id.value,
        itemId: line.itemId.value,
        dispatchedQuantity: dispatched,
        alreadyReturnedQuantity: returned,
        availableToReturnQuantity: available,
      };
    });

    return {
      dispatchId: dispatch.id.value,
      lines,
    };
  }
}
