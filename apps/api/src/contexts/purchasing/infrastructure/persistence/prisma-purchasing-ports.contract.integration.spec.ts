import { describePurchasingPortsContract } from '../../testing/purchasing-ports.contract.js';
import { PrismaPurchasingPortsHarness } from '../testing/prisma-purchasing-ports.harness.js';

// La MISMA suite que corre contra el doble, ahora contra PostgreSQL con el inventario real.
describePurchasingPortsContract('prisma', () => new PrismaPurchasingPortsHarness());
