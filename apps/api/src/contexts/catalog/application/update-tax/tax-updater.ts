import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxFinder } from '../../domain/tax/find/tax-finder.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { TaxName } from '../../domain/tax/tax-name.vo.js';
import { TaxRate } from '../../domain/tax/tax-rate.vo.js';
import { TaxRepository } from '../../domain/tax/tax.repository.js';
import { TaxUniqueness } from '../../domain/tax/unique/tax-uniqueness.js';

export interface TaxUpdaterRequest {
  tenantId: string;
  taxId: string;
  name: string;
  rate: number;
}

export class TaxUpdater {
  constructor(
    private readonly finder: TaxFinder,
    private readonly uniqueness: TaxUniqueness,
    private readonly taxes: TaxRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: TaxUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const tax = await this.finder.find(tenantId, TaxId.of(request.taxId));
    const name = TaxName.of(request.name);
    const rate = TaxRate.of(request.rate);

    await this.uniqueness.ensureNameIsFree(tenantId, name, tax.id);

    tax.update(name, rate, this.clock.now());

    await this.taxes.save(tax);
  }
}
