import { describePayablesPortsContract } from '../../testing/payables-ports.contract.js';
import { PrismaPayablesPortsHarness } from '../testing/prisma-payables-ports.harness.js';

describePayablesPortsContract('PostgreSQL', () => new PrismaPayablesPortsHarness());
