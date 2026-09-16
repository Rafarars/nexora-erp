const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/receivables/domain/shared/amount.ts', 'utf8');

file = file.replace(/value \* 100/g, 'value * 10000');
file = file.replace(/Number\(cents\) \/ 100/g, 'Number(cents) / 10000');
file = file.replace(/centsToNumber\(cents: bigint\)/g, 'baseToNumber(cents: bigint)');
file = file.replace(/toCents\(value: number\)/g, 'toBase(value: number)');
file = file.replace(/paymentCents\(value: number\)/g, 'paymentBase(value: number)');

fs.writeFileSync('apps/api/src/contexts/receivables/domain/shared/amount.ts', file);
