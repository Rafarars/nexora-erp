import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CatalogUsage } from '../../domain/usage/catalog-usage.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxFinder } from '../../domain/tax/find/tax-finder.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { TaxRepository } from '../../domain/tax/tax.repository.js';

export interface TaxStatusChangerRequest {
  tenantId: string;
  taxId: string;
  active: boolean;
}

export class TaxStatusChanger {
  constructor(
    private readonly finder: TaxFinder,
    private readonly usage: CatalogUsage,
    private readonly taxes: TaxRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: TaxStatusChangerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const tax = await this.finder.find(tenantId, TaxId.of(request.taxId));

    if (request.active) {
      tax.activate(this.clock.now());
    } else {
      await this.usage.ensureTaxIsUnused(tenantId, tax.id);
      tax.deactivate(this.clock.now());
    }

    await this.taxes.save(tax);
  }
}
