import { describePayablesPortsContract } from '../../testing/payables-ports.contract.js';
import { InMemoryPayablesPortsHarness } from './in-memory-payables-ports.harness.js';

describePayablesPortsContract('in-memory', () => new InMemoryPayablesPortsHarness());
