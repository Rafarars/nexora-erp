import { describeCatalogRepositoriesContract } from '../../testing/catalog-repositories.contract.js';
import { InMemoryCatalogRepositoriesHarness } from './in-memory-catalog-repositories.harness.js';

describeCatalogRepositoriesContract('in memory', () => new InMemoryCatalogRepositoriesHarness());
