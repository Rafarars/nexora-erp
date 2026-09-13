import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxRepository } from '../../domain/tax/tax.repository.js';

export interface TaxResponse {
  id: string;
  code: string;
  name: string;
  rate: number;
  isActive: boolean;
}

export interface TaxSearcherResponse {
  taxes: TaxResponse[];
}

export class TaxSearcher {
  constructor(private readonly taxes: TaxRepository) {}

  async run(request: { tenantId: string }): Promise<TaxSearcherResponse> {
    const taxes = await this.taxes.searchByTenant(TenantId.of(request.tenantId));

    return {
      taxes: taxes
        .map((tax) => {
          const { id, code, name, rate, isActive } = tax.toPrimitives();

          return { id, code, name, rate, isActive };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }
}
