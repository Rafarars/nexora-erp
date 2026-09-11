import { describeAccessRepositoriesContract } from '../../testing/access-repositories.contract.js';
import { InMemoryAccessRepositoriesHarness } from './in-memory-access-repositories.harness.js';

describeAccessRepositoriesContract(
  'in memory',
  () => new InMemoryAccessRepositoriesHarness(),
);
