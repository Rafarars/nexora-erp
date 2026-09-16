import os, glob, re

# Fix harnesses
harness_files = [
    'apps/api/src/contexts/receivables/infrastructure/testing/prisma-receivables-ports.harness.ts',
    'apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts',
    'apps/api/src/contexts/inventory/infrastructure/testing/prisma-item-ports.harness.ts'
]

props = ", currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false, subtotalVes: 0, taxVes: 0, totalVes: 0, amountVes: 0"

for f in harness_files:
    if os.path.exists(f):
        with open(f, 'r') as file:
            content = file.read()
        
        # Remove any existing injected props if they were duplicated
        content = re.sub(r", currency: 'USD'.*?amountVes: 0", "", content)
        content = re.sub(r", currency: 'USD'.*?totalVes: 0", "", content)
        content = re.sub(r", currency: 'USD'.*?manualExchangeRate: false", "", content)

        content = content.replace("status: 'dispatched'", "status: 'dispatched'" + props)
        content = content.replace("total: invoice.total,", "total: invoice.total" + props + ",")
        content = content.replace("total: amount,", "total: amount" + props + ",")
        content = content.replace("status: 'confirmed'", "status: 'confirmed'" + props)
        content = content.replace("status: 'draft'", "status: 'draft'" + props)
        content = content.replace("status: order.status", "status: order.status" + props)

        with open(f, 'w') as file:
            file.write(content)

