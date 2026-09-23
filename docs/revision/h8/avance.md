# Avance de construccion H8 — Notas de credito y devoluciones

## Comprension previa de las decisiones fundamentales (§3.2, §3.3, §3.4 y §3.10)

Antes de iniciar la Fase 0, se revisaron a fondo las once decisiones de diseno de H8, en especial las cuatro centrales:
- **§3.2 (La nota de credito NO toca el saldo directamente: genera un cobro sin dinero):** El saldo de una factura se calcula o consume en 16 sitios en el backend (`receivables` y `reporting`). Alterar el saldo directamente desincronizaria los calculos. Por ello, confirmar una nota de credito genera de forma atomica un cobro confirmado con metodo `credit_note` asignado a la factura citada hasta su saldo vivo (`PaymentAllocation`). El saldo desciende por la via habitual de cobros, y solo se adapta el rotulo de presentacion en los estados de cuenta para que diga «Nota de credito NCC...».
- **§3.3 (El cupo de cantidad y el cupo de importe son distintos):** Se desacoplan el eje logistico y el financiero. El cupo de cantidad se controla por linea de despacho en ventas y por linea de entrada en compras, impidiendo devolver mercancia de pedidos facturados que aun no han salido de bodega. El cupo de importe se controla por factura. Devolver mercancia reingresa unidades sin tocar saldo, y acreditar importe reduce deuda sin consumir cupos fisicos dos veces.
- **§3.4 (Mercancia devuelta valorada al costo congelado en ambos lados):** Toda devolucion (cliente o proveedor) reingresa o egresa mercancia al costo unitario exacto del movimiento de kardex original (`unitCost`), preservando margenes y asientos contables. Para permitir devoluciones parciales sucesivas sin violar la unicidad de `reversalOfId` (exclusiva para anular documentos enteros), se introduce la columna no unica `restoresMovementId` en `inventory_movements`. Anular una devolucion si utiliza `reversalOfId` sobre el movimiento de la devolucion.
- **§3.10 (Lo que sobra de una nota queda como credito, y se gasta desde Cobros):** Al confirmarse, la nota abona la factura citada solo hasta su saldo vivo; si no hay factura o esta saldada, no genera cobro de emision. El remanente es credito disponible calculado (`NoteCredit = total - cobros_confirmados_aplicados`) sin columnas redundantes en base de datos. Se consume desde Cobros con forma `credit_note` y `creditSourceId` hacia la nota. Los cobros que consumen dicho credito bloquean la nota con `SELECT ... FOR UPDATE` para evitar sobregiros concurrentes. El cobro de emision solo lo anula la anulacion de su nota, mientras que cobros ordinarios que gastaron credito se anulan de forma individual, restituyendo saldo a la nota.

---

## Fase 0: Esquema y correlativos
- **Tablas y enums creados:**
  - Enums: `return_condition` (`resalable`, `damaged`, `scrap`), `sales_return_status` (`draft`, `confirmed`, `cancelled`), `credit_note_status`, `credit_note_reason` (`return`, `subsequent_discount`, `price_correction`, `damaged_goods`, `cancellation`, `other`), `purchase_return_status`.
  - Enum alterado: `payment_method` ampliado con `'credit_note'`.
  - Columnas añadidas: `customer_payments.credit_source_id` (UUID referenciando a `customer_credit_notes`), `inventory_movements.restores_movement_id` (UUID referenciando a `inventory_movements`, con índice, no único para soportar devoluciones parciales sucesivas).
  - Tablas creadas: `sales_returns`, `sales_return_lines`, `customer_credit_notes`, `customer_credit_note_lines`, `purchase_returns`, `purchase_return_lines`.
  - Claves foráneas compuestas seguras con `tenant_id` y restricciones `CHECK` intra-fila añadidas en migración SQL (`20261010000000_create_credit_notes_and_returns`).
- **Prefijos de correlativos registrados:**
  - `DVV` en `apps/api/src/contexts/sales/domain/shared/code-sequence.ts`.
  - `DVC` en `apps/api/src/contexts/purchasing/domain/shared/code-sequence.ts`.
  - `NCC` en `apps/api/src/contexts/receivables/domain/shared/code-sequence.ts`.
- **Adaptación en Receivables:**
  - Actualizado `PAYMENT_METHODS` para incluir `'credit_note'` y soporte de `creditSourceId` en `CustomerPayment` y `receivables-rows.ts`.
- **Verificación:**
  - Migración aplicada y permisos sincronizados (89 permisos). Cliente Prisma regenerado.
  - Typecheck, pruebas unitarias (198 tests) y pruebas de contrato (229 tests) en verde.

---

## Fase 1: Inventario — revertir líneas sueltas
- **Dominio:**
  - Soportados los orígenes `sales_return` y `purchase_return` en `MovementOriginType`.
  - Agregado campo `restoresMovementId` en `InventoryMovement` y sus primitivas, sin restricción única (permitiendo múltiples devoluciones parciales sucesivas sobre un mismo despacho o entrada).
  - Implementado `ItemStock.restore(original, quantity, origin, id, now)`:
    - En devoluciones de venta (salidas restauradas): entra mercancía (`direction: 'in'`) al costo congelado original y pondera el costo promedio de la bodega.
    - En devoluciones de compra (entradas restauradas, H8 §3.8): sale mercancía (`direction: 'out'`) al costo congelado original (distinto del promedio) y recalcula el costo promedio del inventario remanente.
    - Anular una devolución usa `reverse()` normal, generando contrapartida que referencia `reversalOfId = devolucionMovement.id`.
  - Implementado `StockMovements.restore(ledger, document, entries, now)`.
- **Infraestructura y contrato compartido:**
  - Ampliada la interfaz `DocumentStockPosting` con `restore(...)` y `movementsOf(...)`.
  - Implementado en `PrismaDocumentStockPosting` con bloqueo ordenado determinista vía `lockedLedger`.
- **Pruebas:**
  - Pruebas unitarias en `item-stock.entity.spec.ts` y `stock-movements.spec.ts`.
  - Prueba de integración contra PostgreSQL en `prisma-document-stock-posting.integration.spec.ts` validando el recálculo exacto del costo promedio congelado (§3.8) y la anulación en base de datos real.
  - `make verify` completo en verde (416 tests E2E y todas las verificaciones).

---

## Fase 2: Devolución de venta (`DVV`)
- **Dominio:**
  - Creadas entidades `SalesReturn` y `SalesReturnLine` con soporte de condiciones (`resalable`, `damaged`, `scrap`).
  - Ciclo de vida: `draft` -> `confirmed` -> `cancelled`.
  - Puerto `SalesReturnRepository` con búsqueda paginada y cálculo de cupo ya devuelto (`returnedQuantitiesByDispatch`).
  - Puerto `SalesReturnPosting` para confirmar y anular devoluciones.
  - Puerto `SalesReturnCreditedChecker` para verificar si la devolución está acreditada por notas de crédito confirmadas.
  - Fábrica de líneas `SalesReturnLineFactory` que valida bodega activa vía `SalesCatalog`, despacho confirmado, cupo disponible y calcula `baseQuantity`.
- **Aplicación:**
  - `SalesReturnCreator`: valida despacho del mismo cliente, confirmado, fecha no anterior al despacho, cupo y genera código `DVV`.
  - `SalesReturnUpdater`: permite editar borradores.
  - `SalesReturnConfirmer`: confirma y aplica reingreso al inventario.
  - `SalesReturnCanceller`: anula la devolución y revierte movimientos si no tiene notas de crédito confirmadas.
  - `SalesReturnSearcher`: búsqueda y paginación desde el primer día.
  - `DispatchReturnQuotaFinder`: calcula cupos restantes por línea de despacho.
- **Infraestructura y Persistencia:**
  - Mapeo `salesReturnFromRow` y `writeSalesReturnState` en `sales-rows.ts` y `prisma-sales-writer.ts`.
  - `PrismaSalesReturnRepository` implementando almacenamiento y cupos en PostgreSQL.
  - `PrismaSalesReturnPosting` implementando transacciones atómicas con `SELECT ... FOR UPDATE`, validación de cupo en caliente, reingreso al kardex con costo congelado mediante `stock.restore(...)` (sin reingreso para `scrap`, §3.5), reversión de movimientos al anular mediante `stock.reverse(...)`, y garantizando que el pedido de venta **no se toca** (§3.11).
  - `PrismaSalesReturnCreditedChecker` consultando notas de crédito confirmadas.
  - 6 controladores HTTP implementados bajo `/api/v1/sales/returns` y `/api/v1/sales/dispatches/:id/return-quota`.
  - Permisos registrados en `permissions.catalog.ts` en minúsculas (`sales.returns.search`, `sales.returns.create`, `sales.returns.update`, `sales.returns.confirm`, `sales.returns.cancel`).
- **Frontend Web:**
  - Métodos añadidos a `HttpSalesApi` y types en `sales.ts` / `sales-api.ts`.
  - Traducción de errores específicos en `sales-error.ts`.
  - Server actions `saveSalesReturn` y `changeSalesReturn` en `apps/web/src/app/(app)/ventas/actions.ts`.
  - Pantalla completa y tablero `SalesReturnsBoard` en `/ventas/devoluciones`.
  - Enlace "Devoluciones" añadido a `SALES_SECTIONS` y validado en navegación.
- **Pruebas:**
  - Suite de pruebas unitarias `sales-return.spec.ts` verificando:
    - Despacho de otro cliente rechazado (`ReturnCustomerMismatchError`).
    - Despacho en borrador rechazado (`DispatchNotReturnableError`).
    - Fecha anterior al despacho rechazada (`ReturnBeforeDispatchError`).
    - Bodega inactiva rechazada (`InactiveSalesWarehouseError`).
    - Pedido de venta intacto (§3.11).
    - Cupos: dos devoluciones parciales aceptadas, tercera excedida rechazada (`QuantityExceedsDispatchedReturnQuotaError`).
    - Scrap no restaura movimientos en inventario (§3.5).
    - Resalable restaura y su anulación revierte.
    - Anulación bloqueada si tiene notas de crédito confirmadas (`SalesReturnWithCreditNoteError`).

---

## Fase 3: Nota de crédito a cliente (`NCC`)
- **Dominio:**
  - Creadas entidades `CustomerCreditNote` y `CustomerCreditNoteLine`: ciclo de vida `draft` -> `confirmed` -> `cancelled`.
  - Validación de motivos (`CREDIT_NOTE_REASONS`): `return`, `subsequent_discount`, `price_correction`, `damaged_goods`, `cancellation`, `other`. Si el motivo es `other`, el campo `reasonDetail` es obligatorio (`CreditNoteReasonDetailRequiredError`).
  - Entidad `CustomerPayment`: validación y soporte de `creditSourceId`. Obligatorio cuando el método de pago es `credit_note` (`CreditNoteSourceRequiredError`) y prohibido cuando es dinero ordinario (efectivo, transferencia, tarjeta, cheque) (`MoneyPaymentCannotHaveCreditSourceError`).
  - Moneda y tasa congeladas: el cobro con forma `credit_note` adopta la moneda y tasa de cambio congeladas de la nota de crédito.
  - Servicios de dominio:
    - `NoteCredit.available(total, applied)`: cálculo de crédito disponible sin columnas redundantes en base de datos.
    - `CreditQuota.ensureWithinQuota(invoiceTotal, alreadyCredited, noteTotal, invoiceId)`: control de cupo de importe por factura, contabilizando únicamente notas confirmadas.
    - El crédito disponible de notas de crédito **no** reduce la exposición del cliente en el control de crédito.
- **Persistencia e Infraestructura:**
  - `PrismaCustomerCreditNoteRepository`: almacenamiento atómico separando cabecera y líneas con `createMany`, búsqueda paginada y filtros por cliente, factura, devolución, fechas y texto.
  - `PrismaCreditNotePosting`:
    - Bloqueo `FOR UPDATE` para notas y facturas, garantizando aislamiento ante concurrencia.
    - Validación de cupo de importe contra facturas citadas.
    - Creación atómica de cobro automático con método `credit_note` topado al saldo vivo de la factura (`Math.min(balance, note.total)`). Si la factura ya no debe nada o la nota no cita factura, no se genera cobro y todo el importe queda disponible como crédito en la nota (§3.10).
    - Validación de devolución citada: confirmada, del mismo cliente y sin notas de crédito previas.
    - Cierre del backdoor de anulación directa: el cobro de emisión solo puede anularse al anular su nota (`IssuePaymentCannotBeCancelledDirectlyError`).
    - Anulación de nota: bloqueada si su crédito se gastó en cobros externos confirmados (`CreditNoteWithApplicationsError`). Al anularse legítimamente, revierte en la misma transacción su cobro de emisión y restaura el saldo vivo de la factura.
  - `PrismaPaymentPosting`:
    - Bloqueo `FOR UPDATE` de la nota de crédito cuando un cobro utiliza `credit_note`, evitando sobregiros concurrentes.
    - Al anular un cobro ordinario que gastó crédito, el crédito se restituye inmediatamente a la nota.
  - Reportes y Estados de cuenta:
    - `CustomerStatementSearcher` y `PrismaReportingReadModel` / `CustomerStatementReport` adaptados para rotular `'Nota de crédito ' || cn.code` y calcular `noteRemaining` en los movimientos de ambos estados de cuenta.
  - Controladores HTTP y Módulo:
    - 7 controladores registrados en `ReceivablesModule`: creación, edición, confirmación, anulación, búsqueda paginada, consulta individual y consulta de créditos disponibles por cliente.
    - Permisos en minúsculas en `permissions.catalog.ts`: `receivables.creditnotes.search`, `receivables.creditnotes.create`, `receivables.creditnotes.update`, `receivables.creditnotes.confirm`, `receivables.creditnotes.cancel`.
- **Frontend Web:**
  - Actualizados `receivables.ts`, `receivables-api.ts`, `http-receivables-api.ts`, `receivables-error.ts`.
  - Nueva sección `/cuentas-por-cobrar/notas-de-credito` en menú de navegación `RECEIVABLES_SECTIONS`.
  - Tablero completo `CreditNotesBoard` con listado, filtros, panel SlideOver para emitir/editar y opciones de confirmar/anular.
  - Selector de nota de crédito / crédito disponible integrado en `payments-board.tsx`.
- **Pruebas y Verificación:**
  - 23/23 tests de contrato en memoria pasando.
  - 23/23 tests de integración contra PostgreSQL en `prisma-receivables-ports.contract.integration.spec.ts` pasando.
  - 163 archivos de prueba y 3089 tests en API pasando al 100%.
  - 23 archivos de prueba y 198 tests en Web pasando al 100%.
---

## Fase 4: Devolución de compras a proveedor (`DVC`)
- **Dominio:**
  - Creadas entidades `PurchaseReturn` y `PurchaseReturnLine` con ciclo de vida `draft` -> `confirmed` -> `cancelled`.
  - Puerto `PurchaseReturnRepository` para búsqueda paginada y cálculo de cupo ya devuelto (`returnedQuantitiesByReceipt`).
  - Puerto `PurchaseReturnPosting` para confirmación y anulación transaccional con impacto en inventario.
  - Fábrica de líneas `PurchaseReturnLineFactory` validando que la bodega esté activa, que las líneas pertenezcan a la entrada de mercancía citada y que las cantidades no superen el cupo restante de cada línea.
  - Reglas de negocio obligatorias aplicadas:
    - La entrada de mercancía (`goods_receipt`) debe estar confirmada y pertenecer al mismo proveedor (`PurchaseReturnSupplierMismatchError`, `ReceiptNotReturnableError`).
    - La fecha de la devolución no puede ser anterior a la fecha de la entrada (`ReturnBeforeReceiptError`).
    - La bodega de la recepción debe estar activa (`InactivePurchaseWarehouseError`).
    - La devolución de compras **no toca la orden de compra** (§3.11): las cantidades recibidas de las líneas de orden y el estado de la orden permanecen intactos.
    - La salida de inventario sale al costo congelado de la entrada (`unitCost`), distinto del costo promedio, y recalcula ponderadamente el costo promedio de las existencias remanentes en la bodega y en el maestro de artículos (H8 §3.8 y prueba §7).
    - Anulación: revierte el movimiento en inventario mediante `ItemStock.reverse(...)` siempre que no se haya comprometido la existencia.
- **Aplicación:**
  - `PurchaseReturnCreator`: valida proveedor, entrada, fecha, bodega, líneas y asigna correlativo `DVC`.
  - `PurchaseReturnUpdater`: edición de devoluciones en borrador.
  - `PurchaseReturnConfirmer`: confirmación y publicación en inventario al costo congelado.
  - `PurchaseReturnCanceller`: anulación y reversión de salidas.
  - `PurchaseReturnSearcher`: listado paginado con filtros.
  - `ReceiptReturnQuotaFinder`: consulta de cupos disponibles por línea de entrada.
- **Persistencia e Infraestructura:**
  - `PrismaPurchaseReturnRepository`: persistencia de cabecera y líneas en PostgreSQL con orden determinista y paginación.
  - `PrismaPurchaseReturnPosting`: transacción atómica con `SELECT ... FOR UPDATE` sobre la entrada y existencias, validación de cupo en caliente, baja de stock con costo congelado mediante `stock.restore(...)`, actualización del costo promedio en `items` y `item_stocks`, y anulación con `stock.reverse(...)`.
  - Implementación en memoria en `InMemoryPurchasingStore` para pruebas de puerto rápidas y sin base de datos.
  - Contrato ampliado en `purchasing-ports.contract.ts` cubriendo todas las reglas de persistencia, concurrencia, cupos, orden intacta e invariante de valuación §3.8 / §7.
  - 6 controladores HTTP implementados:
    - `POST /api/v1/purchasing/returns`
    - `PUT /api/v1/purchasing/returns/:id`
    - `PUT /api/v1/purchasing/returns/:id/confirm`
    - `PUT /api/v1/purchasing/returns/:id/cancel`
    - `GET /api/v1/purchasing/returns`
    - `GET /api/v1/purchasing/receipts/:id/return-quota`
  - Permisos en minúsculas en `permissions.catalog.ts`:
    - `purchasing.returns.search`, `purchasing.returns.create`, `purchasing.returns.update`, `purchasing.returns.confirm`, `purchasing.returns.cancel`.
  - Matriz de aislamiento (`apps/e2e/support/isolation-matrix.ts`) actualizada y validada con `isolation-coverage.spec.ts`.
- **Frontend Web:**
  - Modelos y utilidades en `purchasing.ts`: `PurchaseReturn`, `PurchaseReturnLine`, `ReceiptReturnQuota`, `purchaseReturnActions`, `summarizePurchaseReturnLines`.
  - Métodos API en `purchasing-api.ts` e `http-purchasing-api.ts`.
  - Traducción de errores amigables en `purchasing-error.ts`.
  - Acciones del servidor `savePurchaseReturn` y `changePurchaseReturn` en `apps/web/src/app/(app)/compras/actions.ts`.
  - Vista completa y tablero `PurchaseReturnsBoard` en `/compras/devoluciones`.
  - Pestaña "Devoluciones" añadida a `PURCHASING_SECTIONS` en barra de navegación de compras.
- **Pruebas y Verificación:**
  - 33/33 tests de contrato en memoria pasando.
  - 33/33 tests de integración contra PostgreSQL real pasando.
  - `make verify` completo en verde:
    - 454/454 tests E2E de Playwright pasando.
    - 253/253 tests de contrato en integración pasando.
    - 3184/3184 tests unitarios de API pasando.
    - 30/30 tests unitarios de Web pasando.
    - Gitleaks sin secretos y Oxlint sin errores.

---

## Fase 5: Restringir anulación de facturas (§3.6)
- **Dominio:**
  - Creado el puerto `SalesReturnsOfInvoice` (`apps/api/src/contexts/sales/domain/invoice/returns/sales-returns-of-invoice.ts`) con el método `countConfirmedReturnsOf(tenantId, orderLineIds)`. «Ventas no aprende de devoluciones, solo pregunta».
  - Creado el error de dominio `InvoiceWithReturnsError` en `sales.errors.ts` con mensaje público amigable y registrado en `error-categories.spec.ts`.
  - Ampliado `InvoicePosting.cancel` para soportar callbacks asíncronos (`Promise<void> | void`).
- **Aplicación:**
  - Actualizado `InvoiceCanceller`: ahora consulta `SalesReturnsOfInvoice` con las líneas de pedido facturadas (`invoicedLines().map(l => l.orderLineId)`). Si hay devoluciones confirmadas sobre dichas líneas, rechaza la anulación lanzando `InvoiceWithReturnsError`.
- **Persistencia e Infraestructura:**
  - Implementado `PrismaSalesReturnsOfInvoice` consultando a través de Prisma las líneas de devolución de venta con estado `confirmed` asociadas a las líneas de despacho correspondientes a los `orderLineIds`.
  - Actualizado `PrismaInvoicePosting.cancel` e `InMemorySalesStore.cancel` para esperar de forma asíncrona el trabajo de cancelación.
  - Implementado `returnsOfInvoice` y métodos de prueba en `InMemorySalesStore`.
  - Cableado de dependencias en `SalesModule` proveyendo `SALES_RETURNS_OF_INVOICE`.
  - Actualizados `prisma-sales-ports.harness.ts` y `seed.ts` (`removeInventory`) para limpiar en cascada segura `customer_credit_notes`, `sales_returns` y `purchase_returns` antes de pedidos, despachos y entradas, garantizando integridad referencial.
- **Frontend:**
  - Añadida la traducción en español de `InvoiceWithReturnsError` en `apps/web/src/modules/sales/domain/sales-error.ts`: *«La factura tiene mercancía devuelta: emite una nota de crédito por el resto en vez de anularla.»*
- **Pruebas y Verificación:**
  - Pruebas unitarias en `sales-cycle.spec.ts`:
    - `an invoice with confirmed returns on its lines cannot be cancelled (§3.6)`.
    - `does not block cancelling an invoice when returns belong to another order (§3.6)`.
    - Validación de que los documentos anulados no bloquean: al anular la devolución, la factura se anula exitosamente.
  - Prueba de integración contra PostgreSQL real en `prisma-sales-returns-of-invoice.integration.spec.ts` validando el ciclo completo contra la base de datos real.
  - `make verify` completo en verde:
    - 454/454 tests E2E de Playwright pasando.
    - 254 tests de contrato en integración pasando.
    - 3186 tests unitarios de API pasando.
    - 202 tests unitarios de Web pasando.
    - Gitleaks sin secretos y Oxlint sin errores.

---

## Fase 6: Semillas de demostración y pruebas extremo a extremo (E2E y Destructivas)

### 1. Semillas de demostración (`apps/api/prisma/seed.ts`)
- **Nuevos maestros sin alterar inventario previo:**
  - Artículo `soap` (`JABON-500`, 'Jabón líquido 500 ml', costo unitario 1,50 USD, precios en listas retail 4,00 / wholesale 3,50 USD). No altera ni una sola unidad de `AGUA-500` (288 un) ni `DETERGENTE-1KG` (50 un), ni las reglas de reorden de bajo mínimo.
  - Cliente `farmacia` (código `CLI000003`, 'Farmacia San Rafael', contado).
- **Resolución de dependencias circulares FK en limpieza (`removeInventory`):**
  - Se añadieron `updateMany` a `null` para `customerCreditNote.issuePaymentId` y `customerPayment.creditSourceId` antes de ejecutar `deleteMany`, permitiendo re-ejecuciones de `make seed` limpias e idempotentes.
- **Cinco casos demostrativos sembrados:**
  1. `DVV000001` (Bodegón La Esquina): devolución en condición `resalable` de 1 caja de agua de `DES000002` sin nota de crédito; reingresa al kardex al costo congelado.
  2. `NCC000001` (Farmacia San Rafael): descuento posterior de `FAC000003` por 11,60 USD sin devolución física; genera cobro de emisión `COB000002` que salda la factura.
  3. `DVV000002` + `NCC000002` (Farmacia San Rafael): devolución de 1 jabón líquido de `DES000004` en condición `scrap` (sin reingreso a kardex) acreditada por nota de crédito `NCC000002` por 13,92 USD con cobro de emisión `COB000003`.
  4. `NCC000003` (Farmacia San Rafael): corrección de precio de `FAC000005` (4,64 USD) por un total de 11,60 USD. Genera cobro de emisión `COB000004` por 4,64 USD, dejando 6,96 USD de crédito disponible. Posteriormente, desde Cobros se consume `COB000005` por 5,00 USD aplicado a `FAC000006`, dejando un saldo disponible restante en la nota de **1,96 USD**.
  5. `DVC000001` (Distribuidora del Valle): devolución a proveedor de 10 botellas de agua de `ENT000002`; salida en kardex al costo congelado de 0,50 USD y orden de compra `OC000003` intacta.
- **Permisos de consulta en semillas:**
  - Incorporados `sales.returns.search`, `purchasing.returns.search` y `receivables.creditnotes.search` al rol `ACME_VIEWER_ROLE` ('Consulta').

### 2. Configuración del proyecto `destructive` en Playwright
- En `apps/e2e/playwright.config.ts`:
  - Creado el proyecto `destructive` (`testDir: './tests/destructive'`, `dependencies: ['api', 'ui', 'isolation', 'performance']`, `fullyParallel: false`, `workers: 1`, `use: { baseURL: API_URL }`).
  - Actualizado el proyecto `resilience` para incluir `'destructive'` en sus dependencias antes de apagar PostgreSQL.

### 3. Pruebas E2E de interfaz de usuario (`tests/ui/credit-notes-returns.spec.ts`)
- Navegación del Administrador por `/ventas/devoluciones`, `/cuentas-por-cobrar/notas-de-credito` y `/compras/devoluciones`, verificando documentos sembrados, estados y cálculo en pantalla de crédito disponible (`NCC000003` con USD 1,96 disponible).
- Verificación del rol solo lectura (Contador): visualiza todos los registros sin botones de acción (`btn-new-sales-return`, `btn-new-credit-note`, `btn-new-purchase-return`).

### 4. Pruebas destructivas y de mutación (`tests/destructive/h8-mutations.spec.ts`)
- Modo serial con `test.afterAll(() => { seedDemoData(); })` para garantizar restauración del entorno.
- **Caso 1:** Bloqueo de anulación de factura con devolución confirmada (`FAC000002` con `DVV000001` rechazada con `409 InvoiceWithReturnsError`).
- **Caso 2:** Control de cupo de crédito disponible en nota de crédito: intento de gastar 1,97 USD cuando el disponible es 1,96 USD es rechazado al confirmar con `409 CreditNoteExceededError`. Cobro válido de 1,00 USD reduce el disponible a 0,96 USD.
- **Caso 3:** Anular el cobro recién confirmado restituye inmediatamente el saldo disponible a 1,96 USD.
- **Caso 4:** Bloqueo de anulación de nota de crédito que tiene cobros confirmados aplicados (`NCC000003` rechazada con `409 CreditNoteWithApplicationsError`).
- **Caso 5:** Bloqueo de anulación directa del cobro generado automáticamente en la emisión de la nota (`COB000002` rechazada con `409 IssuePaymentCannotBeCancelledDirectlyError`).
- **Caso 6:** Ciclo completo de devolución de venta en inventario: confirmación genera reingreso en kardex (`direction: 'in'`) y anulación genera contra-asiento compensatorio (`direction: 'out'`, `isReversal: true`).

### 5. Hallazgos y correcciones durante la verificación
- **Bug en relaciones Prisma de persistencia de ventas:** En `PrismaSalesReturnRepository.returnedQuantitiesByDispatch` y en `PrismaSalesReturnPosting.confirm`, las consultas sobre `salesReturnLine` referenciaban `return:` en lugar del nombre de relación `salesReturn:`. Esto fue detectado por la prueba destructiva de kardex y corregido inmediatamente.

---

## Tres dudas principales de menor certeza para la revisión de Rafael

1. **Flexibilidad en la aplicación automática del cobro de emisión:**
   - *Situación actual:* Al confirmar una nota de crédito vinculada a una factura, el sistema crea forzosamente un cobro de emisión que absorbe el saldo pendiente de la factura hasta donde alcance el total de la nota.
   - *Duda:* ¿Debería el usuario poder decidir qué porción de la nota se aplica a la factura y qué porción queda de inmediato como crédito disponible a favor del cliente, o es preferible mantener la regla determinista de cancelar siempre la deuda inmediata primero?

2. **Reingreso de devoluciones sobre artículos descatalogados o desactivados:**
   - *Situación actual:* Si un artículo inventariado se desactiva para ventas después de haber sido despachado, una devolución posterior de ese despacho en condición `resalable` reingresa la existencia al kardex al costo congelado.
   - *Duda:* Dado que el artículo está inactivo comercialmente, ¿debería el sistema bloquear la devolución en condición `resalable` obligando a reactivar el SKU primero (similar a la regla de compras), o forzar a que la devolución se clasifique como `scrap` / dañada para no dejar stock vendible de artículos retirados?

3. **Interacción con retenciones fiscales e impuestos en notas de crédito (preparación H10):**
   - *Situación actual:* La nota de crédito replica la tasa impositiva de la factura y calcula subtotales/impuestos proporcionales, generando un cobro por el monto nominal total.
   - *Duda:* En el marco tributario venezolano (SENIAT), donde muchas ventas a contribuyentes especiales conllevan retención de IVA (75% o 100%), ¿deberá considerarse en el hito contable (H10) un comprobante de retención sobre notas de crédito, o el modelo de cobro sin dinero actual absorbe limpiamente cualquier saldo remanente sin impacto colateral?

---

## Correcciones de la revisión

### C1: Deshacer el reintento y encontrar la causa del socket hang up

- **Qué cambió:**
  - En `apps/e2e/tests/isolation/tenant-isolation.api.spec.ts`: se revirtió por completo el bloque `for` con reintentos en `read` dentro de `globexSnapshot`, restaurando la llamada simple original `const read = (path: string) => request.get(path, { headers: auth(token) }).then((r) => r.json());`.
  - En `apps/e2e/playwright.config.ts`: se eliminó el ajuste `timeout: 60_000` del proyecto `ui`, restaurando el umbral por omisión de 30 s para todas las pruebas de interfaz.
- **Evidencia empírica de reproducción y descarte:**
  - **Pruebas de aislamiento:** Con el código original sin reintentos, se ejecutaron 2 corridas consecutivas del proyecto `isolation` (`pnpm --filter e2e exec playwright test --project=isolation`):
    - Corrida 1: 190 pasadas (4.0m), 0 fallos, 0 errores de socket hang up.
    - Corrida 2: 190 pasadas (4.0m), 0 fallos, 0 errores de socket hang up.
  - **Suite completa E2E:** Se ejecutaron 2 corridas consecutivas de la suite completa (`pnpm test:e2e`):
    - Corrida 1: 461 pasadas (7.5m), 0 fallos, 0 errores de socket hang up.
    - Corrida 2: 461 pasadas (7.5m), 0 fallos, 0 errores de socket hang up.
  - **Total de pruebas ejecutadas:** 1.302 ejecuciones de pruebas E2E sin un solo `socket hang up`.
  - **Duración medida de la prueba de compras:** La prueba `orders, receives part of it, follows it into the stock and cancels the receipt` registró una duración medida de 13,3 s en ambas corridas completas, muy por debajo del umbral de 30 s.
  - **Conclusión según directriz:** Al no reproducirse el fallo de socket hang up en 1.302 ejecuciones con el entorno limpio y serializado, no se introducen ajustes artificiales de `keepAliveTimeout` en el servidor HTTP (`main.ts`) ni anotaciones `test.slow()` innecesarias. Se documenta la evidencia y se procede con C2.

### C2: Contrato de puerto de las devoluciones de venta

- **Qué cambió:**
  - En `apps/api/src/contexts/sales/testing/sales-ports.harness.ts`: se ampliaron `SalesPorts` con `returns: SalesReturnRepository` y `returnPosting: SalesReturnPosting`, y `SalesPortsHarness` con `movementsOf(...)`.
  - En `apps/api/src/contexts/sales/infrastructure/testing/in-memory-sales-store.ts`: se dotó al doble en memoria de almacenamiento completo para borradores de devolución, búsqueda paginada, suma de cantidades devueltas por despacho, confirmación atómica con control de cupos en caliente y valuación congelada, trazabilidad de movimientos de kardex y reversiones al anular.
  - En `apps/api/src/contexts/sales/infrastructure/testing/in-memory-sales-ports.contract.spec.ts` y `prisma-sales-ports.harness.ts`: se cablearon los repositorios y la consulta de movimientos para ambas implementaciones.
  - En `apps/api/src/contexts/sales/testing/sales-ports.contract.ts`: se introdujeron las suites de contrato `SalesReturnRepository` (guardado, edición, concurrencia de edición, estados no editables, paginación y aislamiento entre inquilinos) y `SalesReturnPosting` (dos devoluciones parciales aceptadas y tercera excedida rechazada, concurrencia de confirmación excediendo cupo con una sola victoriosa, condición scrap sin movimiento en inventario, condición resalable con reingreso al costo congelado de salida citado por `restoresMovementId`, reversión por `reversalOfId` al anular manteniendo intactas las demás devoluciones, e invariante de que el pedido de venta no se toca).
- **Pruebas que lo defienden:**
  - `describeSalesPortsContract`: 32/32 pruebas pasando al 100% tanto en memoria (`in-memory-sales-ports.contract.spec.ts`) como contra base de datos PostgreSQL real (`prisma-sales-ports.contract.integration.spec.ts`).
- **Evidencia de que la prueba fallaba antes:**
  - Al reproducir el error de la fase 2 sustituyendo temporalmente `salesReturn:` por la relación inexistente `return:` en `prisma-sales-return.repository.ts:118`, la prueba de contrato `searches by criteria and counts confirmed returned quantities` falló inmediatamente contra PostgreSQL con:
    `PrismaClientValidationError: Unknown argument return. Available options are marked with ?: salesReturn`.
  - Esto demuestra que el contrato habría atrapado el defecto en la fase 2 antes de llegar a las pruebas destructivas de la fase 6.

### C3: Devolución de venta sin despacho de origen con costo manual y reingreso

- **Qué cambió:**
  - **Dominio:** En `SalesReturnLine` y `SalesReturn`, se amplió la definición para admitir `restoresMovementId: string | null` y `dispatchId: string | null`. En `SalesReturnLineFactory`, se introdujo `originlessLines`, validando que cada artículo exista y esté activo en el catálogo de ventas, que la bodega exista y esté activa, y asignando el costo unitario manual especificado para cada línea.
  - **Aplicación:** En `SalesReturnCreator` y `SalesReturnUpdater`, se implementó soporte para devoluciones sin despacho (`dispatchId: null` o `'none'`). Se valida que se provea `warehouseId`, se consultan las tasas activas mediante `DocumentRates` para asignar la moneda y tasa de cambio de la empresa, y se procesan las líneas con su costo manual.
  - **Infraestructura:**
    - En `PrismaSalesReturnPosting.confirm`: cuando `!returnEntity.dispatchId`, valida bodega activa, aplica el costo unitario congelado manual provisto en la línea y reingresa la existencia a inventario mediante `stock.receive(...)` con origen `sales_return` y sin `restoresMovementId` (`null`), actualizando el costo promedio ponderado de la bodega.
    - En `in-memory-sales-store.ts`: se adaptó la confirmación y anulación para soportar devoluciones sin despacho (generando movimiento `in` con `unitCost` manual provisto en borrador y revirtiéndolo con `reversalOfId` al anular).
    - En `sales-return.request.dto.ts`: Zod schema `SalesReturnDraftSchema` actualizado con `dispatchId: z.string().uuid().nullable().optional()`, `warehouseId: z.string().uuid().nullable().optional()` y líneas con `itemId`, `unitId`, `unitCost` opcionales/requeridos según corresponda.
    - En `sales.module.ts`: inyectado `DOCUMENT_RATES` en `SalesReturnCreator`.
  - **Web / UI:**
    - En `sales-returns-board.tsx`: se añadió soporte en el panel de creación para la opción "Sin despacho (ajuste con costo manual)", desplegando selectores de cliente, bodega, artículo, unidad, cantidad y costo unitario manual (`sales-return-unit-cost-0`).
    - En `sales/devoluciones/page.tsx`: se envían los listados de clientes, bodegas y artículos para poblar los selectores.
    - En `actions.ts` y `sales-api.ts`: actualización de tipos e inputs de API.
- **Pruebas que lo defienden:**
  - **Dominio:** `sales-return.entity.spec.ts` (`creates originless return with manual unit costs`).
  - **Aplicación:** `sales-return.spec.ts` (`creates and edits an originless sales return with manual unit cost`).
  - **Contrato:** `sales-ports.contract.ts` (`creates and confirms an originless return, restoring stock at written unitCost without dispatch or restoresMovementId (H8 §4.1 rule 3)`), verificado en memoria (33/33) y en PostgreSQL real (33/33).
  - **API / E2E:** `apps/e2e/tests/destructive/h8-mutations.spec.ts` (`creates, confirms and cancels an originless sales return via API (H8 §4.1 rule 3)`).
  - **UI / E2E:** `apps/e2e/tests/ui/credit-notes-returns.spec.ts` (`creates an originless sales return with manual cost from the UI (H8 §4.1 rule 3)`).
- **Evidencia de que la prueba fallaba antes:**
  - Antes del cambio, el tipo `SalesReturnDraftProps` y `SalesReturnLineProps` exigían obligatoriamente `dispatchId: string` y `restoresMovementId: string`, provocando error de compilación TypeScript.
  - El DTO HTTP `SalesReturnDraftSchema` rechazaba con error 400 (`validation_error`) cualquier payload sin `dispatchId` o con campos de línea `itemId`/`unitCost`.
  - La lógica de confirmación en `PrismaSalesReturnPosting` asumía incondicionalmente la existencia de despacho e intentaba leer `dispatch.lines`, fallando con excepción al procesar un `dispatchId` nulo.

### C4: El crédito disponible de una nota en un solo sitio (H8 §3.10 y §5.3)

- **Qué cambió:**
  - **Unificación de consulta de lo aplicado en `receivables`:**
    - Creado helper de persistencia compartido `credit-note-applied-query.ts` con `queryAppliedPaymentsSum` y `queryAppliedAmountsByNotes`.
    - Ampliado el puerto `CustomerCreditNoteRepository` con `appliedAmountsByNotes(tenantId, noteIds, excludePaymentId)` y `findByIds(tenantId, ids)`.
    - En `PrismaCustomerCreditNoteRepository`, implementado `appliedAmountsByNotes` (vía `groupBy` sobre `customerPayment.creditSourceId` con `_sum: { amount: true }`), `findByIds` y optimizado `findAvailableCreditsByCustomer` para consultar lo aplicado en lote en vez de nota por nota.
    - En `PrismaPaymentPosting`, sustituida la agregación repetida por `queryAppliedPaymentsSum`, asegurando que el cobro y el repositorio lean exactamente la misma consulta.
    - En `in-memory-receivables-store.ts`, corregido `appliedSumForNote` para sumar `p.amount` (el importe del cobro, que es la base que gasta el crédito de la nota) en lugar de `p.allocations`, e implementados `appliedAmountsByNotes` y `findByIds`.
  - **Buscador de créditos y estado de cuenta de cobros:**
    - En `CustomerAvailableCreditsFinder`, reemplazadas las consultas secuenciales por una sola llamada en lote `appliedAmountsByNotes`.
    - En `CustomerStatementSearcher`, eliminado el límite arbitrario `limit: 1000` y la carga ciega de notas; ahora filtra los `creditSourceId` únicos de los cobros mostrados, carga solo esas notas con `findByIds` y calcula su remanente exacto con `appliedAmountsByNotes` y `NoteCredit.available`.
  - **Alineación con el modelo de lectura de `reporting`:**
    - En `PrismaReportingReadModel` (CTE `note_applied`), se cambió `SUM(a.amount)` sobre `payment_allocations` por `SUM(p.amount)` directamente sobre `customer_payments`, alineando la base de cálculo con la que usa el cobro de `receivables`.
    - En `in-memory-reporting-read-model.ts`, soportado el cálculo consistente de `noteRemaining` sumando `p.amount` sobre cobros con `creditSourceId`.
- **Pruebas que lo defienden:**
  - **Contrato de reporting:** Nueva prueba en `reporting-read-model.contract.ts`: `computes credit note remaining balance using payment amount as base, matching NoteCredit logic`. Pasa 8/8 tanto en memoria como contra PostgreSQL real (`prisma-reporting-read-model.contract.integration.spec.ts`).
  - **Contrato de receivables:** Nueva prueba en `receivables-ports.contract.ts`: `queries applied payment sums across multiple credit notes in batch, respecting payment exclusions`. Pasa 24/24 tanto en memoria (`in-memory-receivables-ports.contract.spec.ts`) como contra PostgreSQL real (`prisma-receivables-ports.contract.integration.spec.ts`).
- **Evidencia de que la prueba fallaba antes:**
  - Al ejecutar la nueva prueba de contrato contra PostgreSQL con la CTE `note_applied` original que sumaba `payment_allocations.amount` (35) en lugar del importe del cobro `customer_payments.amount` (40), la prueba falló con:
    `AssertionError: expected 65 to be 60 // Object.is equality (- Expected: 60, + Received: 65)`.
  - Esto demostró empíricamente la desincronización entre el cálculo de `reporting` y la lógica de dominio de `NoteCredit.available` antes de corregir.

