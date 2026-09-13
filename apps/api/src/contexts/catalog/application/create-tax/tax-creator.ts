import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { CatalogCode } from '../../domain/shared/catalog-code.vo.js';
import { CodeSequence } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { TaxName } from '../../domain/tax/tax-name.vo.js';
import { TaxRate } from '../../domain/tax/tax-rate.vo.js';
import { Tax } from '../../domain/tax/tax.entity.js';
import { TaxRepository } from '../../domain/tax/tax.repository.js';
import { TaxUniqueness } from '../../domain/tax/unique/tax-uniqueness.js';

export interface TaxCreatorRequest {
  tenantId: string;
  name: string;
  rate: number;
}

export class TaxCreator {
  constructor(
    private readonly taxes: TaxRepository,
    private readonly uniqueness: TaxUniqueness,
    private readonly codes: CodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: TaxCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const name = TaxName.of(request.name);
    const rate = TaxRate.of(request.rate);

    await this.uniqueness.ensureNameIsFree(tenantId, name);

    const code = CatalogCode.fromSequence(Tax.CODE_PREFIX, await this.codes.next(tenantId, Tax.CODE_PREFIX));

    await this.taxes.save(Tax.create(TaxId.of(this.ids.next()), tenantId, code, name, rate, this.clock.now()));
  }
}
