import { describeReceivablesPortsContract } from '../../testing/receivables-ports.contract.js';
import { PrismaReceivablesPortsHarness } from '../testing/prisma-receivables-ports.harness.js';

// La MISMA suite que corre contra el doble, ahora contra PostgreSQL.
describeReceivablesPortsContract('prisma', () => new PrismaReceivablesPortsHarness());
