import { Controller, Get } from '@nestjs/common';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { SessionFinder } from '../../application/find-session/session-finder.js';
import type { AccessSessionResponse } from '../../application/session/access-session.response.js';

@Controller('api/v1/auth')
export class SessionGetController {
  constructor(private readonly finder: SessionFinder) {}

  // Ningun permiso concreto: cualquiera con sesion valida puede preguntar quien es.
  @Get('me')
  @AuthenticatedOnly()
  async run(@Session() current: CurrentSession): Promise<AccessSessionResponse> {
    return this.finder.run(current);
  }
}
