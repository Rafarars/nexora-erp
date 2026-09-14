import { Module } from '@nestjs/common';
import { ConfigModule } from './shared/config/config.module.js';
import { SharedModule } from './shared/infrastructure/shared.module.js';
import { HealthModule } from './health/health.module.js';
import { AccessModule } from './contexts/access/infrastructure/access.module.js';
import { CatalogModule } from './contexts/catalog/infrastructure/catalog.module.js';
import { SalesModule } from './contexts/sales/infrastructure/sales.module.js';
import { PurchasingModule } from './contexts/purchasing/infrastructure/purchasing.module.js';
import { InventoryModule } from './contexts/inventory/infrastructure/inventory.module.js';

@Module({
  imports: [ConfigModule, SharedModule, HealthModule, AccessModule, CatalogModule, InventoryModule, PurchasingModule, SalesModule],
})
export class AppModule {}
