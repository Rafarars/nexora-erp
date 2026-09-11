import { describeAccessRepositoriesContract } from '../../testing/access-repositories.contract.js';
import { PrismaAccessRepositoriesHarness } from '../testing/prisma-access-repositories.harness.js';

// La MISMA suite que corre contra los dobles, ahora contra PostgreSQL de verdad.
describeAccessRepositoriesContract(
  'prisma',
  () => new PrismaAccessRepositoriesHarness(),
);
