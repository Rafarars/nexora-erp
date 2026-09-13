import { DuplicateTaxNameError } from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TaxId } from '../tax-id.vo.js';
import { TaxName } from '../tax-name.vo.js';
import { TaxRepository } from '../tax.repository.js';

export class TaxUniqueness {
  constructor(private readonly taxes: TaxRepository) {}

  async ensureNameIsFree(tenantId: TenantId, name: TaxName, except?: TaxId): Promise<void> {
    const existing = await this.taxes.findByName(tenantId, name);

    if (existing && !(except && existing.id.equals(except))) {
      throw new DuplicateTaxNameError(name.value, tenantId.value);
    }
  }
}
