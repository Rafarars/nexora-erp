const fs = require('fs');

let file = fs.readFileSync('apps/web/src/app/(app)/cuentas-por-cobrar/cobros/page.tsx', 'utf8');

file = file.replace(
  "today={(await companyApi().settings(token)).today}",
  "settings={await companyApi().settings(token)}"
);

fs.writeFileSync('apps/web/src/app/(app)/cuentas-por-cobrar/cobros/page.tsx', file);
