import { describeSalesPortsContract } from '../../testing/sales-ports.contract.js';
import { PrismaSalesPortsHarness } from '../testing/prisma-sales-ports.harness.js';

// La MISMA suite que corre contra el doble, ahora contra PostgreSQL con el inventario real.
describeSalesPortsContract('prisma', () => new PrismaSalesPortsHarness());
