import { describeItemPortsContract } from '../../testing/item-ports.contract.js';
import { InMemoryItemPortsHarness } from './in-memory-item-ports.harness.js';

describeItemPortsContract('in memory', () => new InMemoryItemPortsHarness());
