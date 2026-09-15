import { describeCompanyPortsContract } from '../../testing/company-ports.contract.js';
import { PrismaCompanyPortsHarness } from '../testing/prisma-company-ports.harness.js';

// La MISMA suite que corre contra los dobles, ahora contra PostgreSQL de verdad.
describeCompanyPortsContract('prisma', () => new PrismaCompanyPortsHarness());
