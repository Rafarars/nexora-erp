import { describeCompanyPortsContract } from '../../testing/company-ports.contract.js';
import { InMemoryCompanyPortsHarness } from './in-memory-company-ports.harness.js';

describeCompanyPortsContract('in memory', () => new InMemoryCompanyPortsHarness());
