import { BusinessCalendar } from '../../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CompanySettingsFinder } from '../find/company-settings-finder.js';

// El calendario que publican las empresas: hoy, en la zona horaria de cada una.
export class CompanyCalendar implements BusinessCalendar {
  constructor(
    private readonly settings: CompanySettingsFinder,
    private readonly clock: Clock,
  ) {}

  async today(tenantId: string): Promise<string> {
    return (await this.settings.find(TenantId.of(tenantId))).todayAt(this.clock.now());
  }
}
