import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CompanyProfileUpdater } from '../../application/update-company-profile/company-profile-updater.js';
import { companyProfileRequestSchema } from './dto/company.request.dto.js';
import type { CompanyProfileRequestDto } from './dto/company.request.dto.js';

@Controller('api/v1/company')
export class UpdateCompanyProfilePutController {
  constructor(private readonly updater: CompanyProfileUpdater) {}

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company.profile.update')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(companyProfileRequestSchema)) body: CompanyProfileRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, tenantId: session.tenantId });
  }
}
