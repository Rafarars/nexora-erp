# H10 — Contabilidad: Partida doble generada desde las operaciones
## Avance de construccion (Fase 0 a Fase 6)

### Comprension inicial de invariantes fundamentales

1. **La invariante absoluta del constructor (`JournalEntry`, §2.1):**
   Un asiento contable en Nexora nace estrictamente cuadrado o no nace (`debit === credit`). Al no existir asientos tecleados a mano por usuarios, no existe la figura de asientos incompletos o en borrador en base de datos. Si una operacion produce un asiento donde la suma del debe difiere del haber, el constructor de `JournalEntry` lanza una excepcion inmediata de dominio. Asimismo, ninguna linea puede tener debe y haber al mismo tiempo, ni montos negativos, ni ambos lados en cero, invariante garantizada en dominio y blindada en PostgreSQL mediante restricciones `CHECK`.

2. **Determinacion de cuentas por precedencia en un unico sitio (§2.5):**
   Las cuentas se resuelven consultando una jerarquia estricta: **Articulo → Categoria → Empresa**. Las cuentas operativas por producto (Inventario, Costo de ventas, Ingresos, Gasto de compras) evaluan primero la configuracion del articulo; si no esta, suben a su categoria; y si no, caen a la cuenta por omision de la empresa. Las 12 cuentas restantes (Caja, Clientes, Proveedores, Mercancia por facturar, Diferencia en cambio, Patrimonio de apertura, etc.) se resuelven a nivel de empresa. Si ningun nivel resuelve la cuenta necesaria, la operacion se rechaza arrojando un error claro de configuracion: jamas se inventa una cuenta por omision que falsee la balanza.

3. **Origen del costo de ventas desde el despacho y el kardex (§2.4 y §2.4.1):**
   El costo de ventas no se recalcula al facturar ni se basa en promedios estimados: el costo de ventas lo contabiliza el despacho fisico a partir del costo exacto de los movimientos de kardex generados. Al facturar antes de despachar, la factura solo contabiliza el ingreso y los impuestos; el costo se contabiliza unicamente cuando ocurre el despacho. Asi, el mayor de Inventario refleja en todo momento la valuacion exacta del kardex bajo el principio de inventario perpetuo.

4. **El asiento de apertura equilibrado contra Patrimonio de apertura (§3.13):**
   Los saldos vivos acumulados hasta la fecha de corte (existencia en bodega, facturas por cobrar y facturas por pagar) se capturan directamente desde sus fuentes autorizadas (`RECEIVABLE_BALANCES`, `PAYABLE_BALANCES` y valuacion del kardex) sin recalcular restas secundarias. Dado que los activos operativos dificilmente igualan a los pasivos, el neto patrimonial que equilibra la ecuacion fundamental ($Activo - Pasivo = Patrimonio$) se imputa a la cuenta obligatoria **Patrimonio de apertura**, permitiendo que la Balanza de comprobacion arranque perfectamente cuadrada al centavo.

---

### Fase 0 — Alinear ventas con el patron declarativo de compras
- **Objetivo**: Alinear `InvoicePosting.issue`, `InvoicePosting.cancel` y `SalesOrderPosting.post` para retornar tuplas declarativas con sus entidades modificadas (`InvoicePostingResult`, `InvoiceCancelResult`, `SalesOrder`), eliminando mutaciones internas opacas.
- **Archivos adaptados**:
  - `apps/api/src/contexts/sales/domain/invoice/posting/invoice-posting.ts`: interfaces `InvoicePostingResult` y `InvoiceCancelResult`.
  - `apps/api/src/contexts/sales/domain/invoice/posting/invoice-issuance.ts`: `cancel` retorna `{ invoice, order }`.
  - `apps/api/src/contexts/sales/domain/order/posting/sales-order-posting.ts`: firma `post` retorna `SalesOrder`.
  - `apps/api/src/contexts/sales/domain/order/posting/stock-reservation.ts`: `confirm` retorna `order`.
  - `apps/api/src/contexts/sales/application/issue-invoice/invoice-issuer.ts`: retorna `InvoicePostingResult`.
  - `apps/api/src/contexts/sales/application/cancel-invoice/invoice-canceller.ts`: retorna `InvoiceCancelResult`.
  - `apps/api/src/contexts/sales/application/cancel-order/sales-order-canceller.ts`: retorna `order`.
  - `apps/api/src/contexts/sales/infrastructure/persistence/prisma-invoice-posting.ts`: persiste declarativamente `result.invoice` y `result.order`.
  - `apps/api/src/contexts/sales/infrastructure/persistence/prisma-sales-order-posting.ts`: persiste `updatedOrder`.
  - `apps/api/src/contexts/sales/infrastructure/testing/in-memory-sales-store.ts`: adaptado al retorno declarativo.
  - `apps/api/src/contexts/sales/testing/sales-ports.contract.ts`: adaptado con `new InvoiceIssuance().apply(...)` en `issue`, `cancel` retornando `{ invoice, order }`, y `orderPosting.post` retornando `order`.
- **Evidencias de verificacion**:
  - `pnpm --filter api test src/contexts/sales/`: 16 test files passed, 335 tests passed.
  - `DATABASE_URL=... pnpm --filter api test:integration src/contexts/sales/`: 2 test files passed, 34 tests passed.
  - `make verify`: 1/6 secrets verde, 2/6 lint verde, 3/6 typecheck verde, 4/6 unit verde, 5/6 contract verde, 6/6 e2e verde (527 passed).
- **Estado**: Completada.

### Fase 1 — Plan de cuentas y catalogo contable
- **Objetivo**: Crear el modelo de datos de contabilidad (`Account`, `JournalEntry`, `JournalEntryLine`), las 16 cuentas por omision en `CompanySettings`, 4 en `Item` y 4 en `Category`, el catalogo canónico de 39 cuentas sembrado, el contexto hexagonal `accounting` para cuentas y la pantalla `/contabilidad/cuentas`.
- **Archivos creados y adaptados**:
  - `apps/api/prisma/schema.prisma` y migracion `20261014000000_create_accounting_context`: modelos contables con CHECK constraints en base de datos.
  - `apps/api/prisma/seed.ts`: siembra de catalogo de 39 cuentas por omision para cada tenant y vinculacion en `CompanySettings`.
  - `apps/api/src/contexts/accounting/domain/`: entidad `Account`, enum `AccountType`, errores de dominio `AccountingError`.
  - `apps/api/src/contexts/accounting/application/`: puerto `AccountRepository`, use cases `CreateAccountUseCase`, `UpdateAccountUseCase`, `SearchAccountsUseCase`.
  - `apps/api/src/contexts/accounting/infrastructure/`: `PrismaAccountRepository`, `InMemoryAccountRepository`, controladores HTTP con permisos y guards.
  - `apps/api/src/contexts/accounting/accounting.module.ts`: registrado en `app.module.ts`.
  - `apps/api/src/contexts/access/domain/role/permissions.catalog.ts`: permisos `accounting:accounts:read`, `accounting:accounts:create`, `accounting:accounts:update`.
  - `apps/web/src/modules/accounting/`: cliente HTTP, tipos y helpers.
  - `apps/web/src/sections/accounting/` y `apps/web/src/app/(app)/contabilidad/cuentas/`: arbol jerarquico de cuentas, buscador, panel de edicion (`useEditingDraft`), alta y cambio de estado.
  - `apps/e2e/pages/accounting.page.ts` y `apps/e2e/tests/ui/accounting.spec.ts`: POM y pruebas de interfaz de usuario.
  - `apps/e2e/support/isolation-matrix.ts`: casos de aislamiento multi-inquilino para las rutas de cuentas.
- **Evidencias de verificacion**:
  - `pnpm --filter api test`: 191 test files passed, 3932 tests passed.
  - `DATABASE_URL=... pnpm --filter api test:integration`: 15 test files passed, 317 tests passed.
  - `pnpm --filter web test`: 25 test files passed, 236 tests passed.
  - `make verify`: 1/6 secrets verde, 2/6 lint verde, 3/6 typecheck verde, 4/6 unit verde, 5/6 contract verde, 6/6 e2e verde (532 passed).
- **Estado**: Completada.

### Fase 2 — Asiento contable, balance y determinacion de cuentas
- **Objetivo**: Implementar la entidad inmutable `JournalEntry` con su invariante absoluta del constructor (`debit === credit` al centavo exacto, lineas `debit > 0 ^ credit > 0`), el reversor automatico de asientos (`entry.reverse()`), el resolvedor puro de cuentas con precedencia Articulo → Categoria → Empresa (`AccountResolver`), el constructor puro de asientos para las trece operaciones de negocio (`EntryBuilder`), secuencia de codigos `AST-`, repositorios en memoria y Prisma con sus contratos de puerto e integracion en PostgreSQL real, casos de uso de busqueda y consulta de asientos, endpoints HTTP `GET /api/v1/accounting/entries` y `GET /api/v1/accounting/entries/:id` protegidos por permisos y aislados por empresa, pantalla web `/contabilidad/asientos` con buscador, selector de origen y modal de detalle con balance cuadrado visible, y pruebas E2E de UI y multi-inquilino.
- **Archivos creados y adaptados**:
  - `apps/api/src/contexts/accounting/domain/journal/journal-entry-line.entity.ts`: lineas con invariante `debit > 0 ^ credit > 0`.
  - `apps/api/src/contexts/accounting/domain/journal/journal-entry.entity.ts`: entidad `JournalEntry` con validacion estricta al centavo, inmutabilidad y metodo `reverse()`.
  - `apps/api/src/contexts/accounting/domain/journal/journal-entry.repository.ts`: puerto de persistencia y lectura.
  - `apps/api/src/contexts/accounting/domain/journal/accounting-code-sequence.ts`: puerto para codigos `AST-000001`.
  - `apps/api/src/contexts/accounting/domain/journal/entry-builder.ts`: factory puro para las trece operaciones contables (§3.1 a §3.13).
  - `apps/api/src/contexts/accounting/domain/determination/account-resolver.ts`: motor puro de determinacion de cuentas segun jerarquia (§2.5).
  - Pruebas unitarias de dominio: `journal-entry.entity.spec.ts` (9 tests), `account-resolver.spec.ts` (6 tests), `entry-builder.spec.ts` (12 tests).
  - `apps/api/src/contexts/accounting/infrastructure/persistence/`: `PrismaJournalEntryRepository` y `PrismaAccountingCodeSequence`.
  - `apps/api/src/contexts/accounting/infrastructure/testing/`: `InMemoryJournalEntryRepository`, `InMemoryAccountingCodeSequence`, arneses de pruebas y contrato.
  - Pruebas de contrato: `in-memory-journal-entry-repository.contract.spec.ts` (4 tests) y `prisma-journal-entry-repository.contract.integration.spec.ts` (4 tests contra Postgres).
  - `apps/api/src/contexts/accounting/application/`: `SearchJournalEntriesUseCase` y `GetJournalEntryUseCase` con sus pruebas unitarias.
  - Controladores HTTP: `SearchJournalEntriesGetController` y `GetJournalEntryGetController` con DTOs de validacion y decoradores de permisos.
  - `apps/api/src/contexts/access/domain/role/permissions.catalog.ts` y `apps/api/prisma/seed.ts`: permisos `accounting.entries.search` y `accounting.entries.read`.
  - Frontend web: `apps/web/src/modules/accounting/domain/accounting.ts`, `apps/web/src/modules/accounting/infrastructure/http-accounting-api.ts`, `apps/web/src/sections/accounting/journal-entries-table.tsx`, `apps/web/src/app/(app)/contabilidad/asientos/page.tsx`, `apps/web/src/app/(app)/contabilidad/actions.ts`.
  - Pruebas E2E: `apps/e2e/pages/accounting.page.ts`, `apps/e2e/tests/ui/accounting.spec.ts`, `apps/e2e/support/isolation-matrix.ts`.
- **Investigacion y correccion de incidencias (Regla 2 y Regla 3)**:
  - *Incidencia en `make test-contract`*: Al correr la suite de integracion con PostgreSQL real, se produjo una falla en `prisma-catalog-repositories.contract.integration.spec.ts` (`Foreign key constraint violated on the constraint: supplier_credit_notes_tenant_id_purchase_return_id_fkey`) y consecuentemente en `prisma-company-ports.contract.integration.spec.ts`.
  - *Causa raiz*: En H9 se crearon tablas de cuentas por pagar (`supplierCreditNote`, `supplierCreditNoteLine`, `supplierPaymentAllocation`, `supplierPayment`) con restricciones de clave ajena `RESTRICT` hacia `purchaseReturn`. Varios arneses de prueba de contratos antiguos (`catalog`, `access`, `company`, `receivables`, `reporting`) realizaban `this.prisma.purchaseReturn.deleteMany()` en su metodo `reset()` sin vaciar previamente las tablas dependientes de proveedores, ni las tablas de contabilidad de H10 (`journalEntryLine`, `journalEntry`). Al ejecutarse la suite secuencialmente sobre la misma base de datos compartida, un test previo dejaba filas de proveedores y el reset del siguiente fallaba.
  - *Solucion*: Se estandarizo el orden de limpieza en cascada en todos los arneses de PostgreSQL (`prisma-catalog-repositories.harness.ts`, `prisma-access-repositories.harness.ts`, `prisma-company-ports.harness.ts`, `prisma-receivables-ports.harness.ts`, `prisma-reporting-read-model.harness.ts`, `prisma-sales-ports.harness.ts`, `prisma-payables-ports.harness.ts`, `prisma-item-ports.harness.ts`, `prisma-inventory-ports.harness.ts`), vaciando primero `journalEntryLine` y `journalEntry`, luego asignaciones y pagos de proveedores y clientes, lineas y notas de credito, antes de las devoluciones y facturas.
- **Evidencias de verificacion**:
  - `pnpm --filter api test`: 197 test files passed, 3988 tests passed.
  - `pnpm --filter web test`: 25 test files passed, 236 tests passed.
  - `make test-contract`: 16 test files passed, 321 tests passed contra PostgreSQL real.
  - `pnpm --filter e2e test tests/ui/accounting.spec.ts`: 2 passed.
  - `pnpm --filter e2e test tests/isolation/`: 240 passed (cobertura total y aislamiento multi-tenant).
  - `make verify`: 1/6 secrets verde, 2/6 lint verde, 3/6 typecheck verde, 4/6 unit verde, 5/6 contract verde, 6/6 e2e verde (535 passed).
- **Estado**: Completada.

---

