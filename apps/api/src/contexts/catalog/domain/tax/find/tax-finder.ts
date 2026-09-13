import { TaxNotFoundError } from '../../errors/not-found.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TaxId } from '../tax-id.vo.js';
import { Tax } from '../tax.entity.js';
import { TaxRepository } from '../tax.repository.js';

export class TaxFinder {
  constructor(private readonly taxes: TaxRepository) {}

  async find(tenantId: TenantId, id: TaxId): Promise<Tax> {
    const tax = await this.taxes.find(tenantId, id);

    if (!tax) {
      throw new TaxNotFoundError(id.value);
    }

    return tax;
  }
}
