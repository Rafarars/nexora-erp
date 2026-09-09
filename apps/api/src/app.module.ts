import { Module } from '@nestjs/common';
import { ConfigModule } from './shared/config/config.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [ConfigModule, HealthModule],
})
export class AppModule {}
