import { describeInventoryPortsContract } from '../../testing/inventory-ports.contract.js';
import { PrismaInventoryPortsHarness } from '../testing/prisma-inventory-ports.harness.js';

// La MISMA suite que corre contra el doble, ahora contra PostgreSQL con bloqueos de verdad.
describeInventoryPortsContract('prisma', () => new PrismaInventoryPortsHarness());
