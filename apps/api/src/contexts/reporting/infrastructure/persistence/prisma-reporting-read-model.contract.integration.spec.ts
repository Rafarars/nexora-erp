import { describeReportingReadModelContract } from '../../testing/reporting-read-model.contract.js';
import { PrismaReportingReadModelHarness } from '../testing/prisma-reporting-read-model.harness.js';

// La MISMA suite que corre contra el doble, ahora contra las consultas SQL.
describeReportingReadModelContract('prisma', () => new PrismaReportingReadModelHarness());
