import { describeItemPortsContract } from '../../testing/item-ports.contract.js';
import { PrismaItemPortsHarness } from '../testing/prisma-item-ports.harness.js';

// La MISMA suite que corre contra los dobles, ahora contra PostgreSQL de verdad.
describeItemPortsContract('prisma', () => new PrismaItemPortsHarness());
