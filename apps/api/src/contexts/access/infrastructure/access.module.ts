import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import {
  MEMBERSHIP_REPOSITORY,
} from '../domain/membership/membership.repository.js';
import { ROLE_REPOSITORY } from '../domain/role/role.repository.js';
import { TENANT_REPOSITORY } from '../domain/tenant/tenant.repository.js';
import { USER_REPOSITORY } from '../domain/user/user.repository.js';
import { PrismaMembershipRepository } from './persistence/prisma-membership.repository.js';
import { PrismaRoleRepository } from './persistence/prisma-role.repository.js';
import { PrismaTenantRepository } from './persistence/prisma-tenant.repository.js';
import { PrismaUserRepository } from './persistence/prisma-user.repository.js';

// El unico sitio del contexto donde se decide QUE implementacion resuelve cada puerto.
// Los tokens son Symbol porque las interfaces de TypeScript se borran al compilar.
@Module({
  imports: [PrismaModule, SharedModule],
  providers: [
    { provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: MEMBERSHIP_REPOSITORY, useClass: PrismaMembershipRepository },
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
  ],
  exports: [TENANT_REPOSITORY, USER_REPOSITORY, MEMBERSHIP_REPOSITORY, ROLE_REPOSITORY],
})
export class AccessModule {}
