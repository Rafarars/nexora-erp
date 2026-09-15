import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CompanySettingsUpdater } from '../../application/update-company-settings/company-settings-updater.js';
import { companySettingsRequestSchema } from './dto/company.request.dto.js';
import type { CompanySettingsRequestDto } from './dto/company.request.dto.js';

@Controller('api/v1/company')
export class UpdateCompanySettingsPutController {
  constructor(private readonly updater: CompanySettingsUpdater) {}

  @Put('settings')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company.settings.update')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(companySettingsRequestSchema)) body: CompanySettingsRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, tenantId: session.tenantId });
  }
}
