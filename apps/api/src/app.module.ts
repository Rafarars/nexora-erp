import { Module } from '@nestjs/common';
import { ConfigModule } from './shared/config/config.module.js';
import { SharedModule } from './shared/infrastructure/shared.module.js';
import { HealthModule } from './health/health.module.js';
import { AccessModule } from './contexts/access/infrastructure/access.module.js';

@Module({
  imports: [ConfigModule, SharedModule, HealthModule, AccessModule],
})
export class AppModule {}
