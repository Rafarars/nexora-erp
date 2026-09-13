import { describeCatalogRepositoriesContract } from '../../testing/catalog-repositories.contract.js';
import { PrismaCatalogRepositoriesHarness } from '../testing/prisma-catalog-repositories.harness.js';

// La MISMA suite que corre contra los dobles, ahora contra PostgreSQL de verdad.
describeCatalogRepositoriesContract('prisma', () => new PrismaCatalogRepositoriesHarness());
