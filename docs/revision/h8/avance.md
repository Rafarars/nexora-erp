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
  - Cobertura de aislamiento en `apps/e2e/support/isolation-matrix.ts` ampliada y validada con `isolation-coverage.spec.ts`.



