const fs = require('fs');

let f1 = 'apps/api/src/contexts/receivables/infrastructure/receivables.module.ts';
let t1 = fs.readFileSync(f1, 'utf8');
t1 = t1.replace(/import \{ DocumentRates \} from '..\/..\/..\/..\/shared\/domain\/ports\/document-rates.js';/g, "import { DocumentRates } from '../../../shared/domain/ports/document-rates.js';");
fs.writeFileSync(f1, t1);

let f2 = 'apps/api/src/contexts/receivables/application/update-payment/payment-updater.ts';
let t2 = fs.readFileSync(f2, 'utf8');
t2 = t2.replace(/allocations: request.allocations.map\(\(allocation\) => \(\{\n\s*id: this.ids.next\(\),\n\s*\.\.\.allocation,\n\s*\}\)\),/g, 'allocations: request.allocations.map((allocation) => ({\n        id: this.ids.next(),\n        ...allocation,\n        exchangeDifference: 0\n      })),');
fs.writeFileSync(f2, t2);
