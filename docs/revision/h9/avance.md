# Avance de construcción: H9 — Compras hasta el pago

Este documento registra el avance de construcción del hito H9 fase por fase, para alguien que no estuvo presente.
Toda cifra, ruta, título de prueba, nombre de error o línea de fallo se copia de la salida de un comando real (`git grep -n`, `sed -n`, el registro de la suite).

---

## Entendimiento previo (§3.3, §3.4, §3.10)

### §3.3 Diferencia de precio: revaluación por importe, reparto al aprobar y dos monedas
1. **La factura de compra no mueve inventario directamente:** Al confirmar una factura de compra cuyo precio difiere del costo de entrada, se genera un ajuste de inventario de tipo `revaluation` en **borrador** con `originType: 'purchase_invoice'` y `originId: invoice.id` (uno por bodega si abarca varias). Sus líneas son de tipo **revaluación por importe** (`revaluationKind: 'amount'`), registrando el importe total de la diferencia (`amount`) y el movimiento de kardex de la entrada (`sourceMovementId`).
2. **El reparto se realiza al aprobar el ajuste, no al facturar:** Entre la emisión de la factura y la aprobación del ajuste ocurren ventas y nuevas entradas. El costo nuevo no se congela al facturar ni se fija un reparto estático de antemano. Al aprobar el ajuste, el servicio `PriceVariance` reparte el importe con el estado real del kardex en ese momento:
   - Bajo costo promedio ponderado, cada salida (`out`) desde el movimiento de entrada se llevó su parte proporcional del valor. La parte que permanece en bodega (`stockPart`) es el importe multiplicado por el producto de `(balanceQuantity después / balanceQuantity antes)` de cada salida posterior.
   - `soldPart = amount - stockPart` va a resultado (cuenta de Diferencia de precio de compra en H10).
   - Las devoluciones a proveedor de esa misma entrada no computan como salidas porque salieron al costo congelado de la entrada.
   - Si al aprobar ya se vendió todo (`available === 0`), `stockPart = 0` y `soldPart = amount`, aprobándose sin escribir movimientos en el kardex (no lanza `NothingToRevalueError`).
   - Si queda existencia, `stockPart` actualiza el kardex mediante salida al costo viejo y reingreso al nuevo costo `(valor_actual + stockPart) / existencia_actual`.
   - Al anular la factura: si el ajuste está en borrador se descarta/anula; si ya estaba confirmado, genera un nuevo ajuste por importe opuesto (`-amount`) en borrador citando la misma entrada (nunca revierte movimientos de kardex antiguos).
3. **Monedas y diferencial cambiario:** La línea de factura va en la moneda de la entrada. La diferencia de precio se calcula en esa moneda y se convierte a la moneda de la empresa **a las tasas de la entrada**. Lo que separa las tasas de la factura de las tasas de la entrada es estrictamente **diferencia en cambio** (`exchangeDifference`), la cual se almacena en la factura y no toca el inventario.

### §3.4 Lo pedido ≥ lo recibido ≥ lo facturado
La línea de la orden de compra incorpora `invoicedQuantity`. Al confirmar la factura:
- Para líneas con entrada de origen: la cantidad no puede superar `recibido - devuelto - ya_facturado` (utilizando la lógica del cupo de devolución de `ReceiptReturnQuotaFinder`).
- Para líneas de servicios de una orden: no puede superar `pedido - ya_facturado`.
- Facturar más de lo recibido se rechaza en el dominio (regla 3 de §4.1).
- Bloqueo transaccional ordenado: Factura -> Entradas citadas (ordenadas por `id`) -> Órdenes.

### §3.10 Nota de crédito de proveedor (`NCP`)
- Vive en el nuevo contexto `payables` y replica la mecánica de la `NCC` de H8:
- Si cita una factura, al confirmarse genera automáticamente un pago sin dinero (`SupplierPayment`, método `credit_note`) aplicado a esa factura hasta su saldo vivo (`issuePaymentId`).
- El sobrante queda como **crédito disponible** calculado en caliente (`NoteCredit = total - pagos_confirmados_aplicados`), nunca almacenado en columnas.
- Dicho crédito se consume desde Pagos con método `credit_note` y `creditSourceId` apuntando a la nota, con bloqueo `NCP` -> Pago -> Facturas.
- Si acredita una devolución: valida que la devolución esté confirmada, sea del mismo proveedor, no esté ya acreditada y que sus líneas correspondan a líneas de entrada que esa factura facturó (§4.4). No toca inventario ni kardex.
- Si es una rebaja de precio sin devolución: genera un ajuste de revaluación por importe negativa en borrador, repartiéndose al aprobarse igual que en §3.3.

---

### Ejemplo numérico resuelto (§3.3: dos entradas a distinto costo antes de facturar)
- **Momento 1 (Entrada 1):** Entran 10 unidades a 100 Bs.
  - Kardex: `balanceQuantity` = 10, valor total = 1.000 Bs (costo unitario 100 Bs).
- **Momento 2 (Entrada 2):** Entran 10 unidades a 150 Bs.
  - Kardex: `balanceQuantity` = 20, valor total = 2.500 Bs (costo promedio 125 Bs).
- **Momento 3 (Salida/Venta):** Se venden 15 unidades.
  - Kardex salida: existencia antes = 20, cantidad que sale = 15, existencia después (`balanceQuantity`) = 5.
  - Fracción que queda = 5 / 20 = 0.25.
- **Momento 4 (Factura):** Llega la factura del primer lote (10 unidades) a 110 Bs (en vez de 100 Bs).
  - Diferencia de precio total = (110 - 100) * 10 = +100 Bs.
  - La factura genera un ajuste de revaluación por importe con `amount = +100` y `sourceMovementId` de la Entrada 1.
- **Momento 5 (Aprobación del ajuste):**
  - Salidas desde la Entrada 1: la venta de 15 unidades.
  - Factor de permanencia = 5 / 20 = 0.25.
  - `stockPart = +100 * 0.25 = +25 Bs` (absorbido por la bodega).
  - `soldPart = +100 - 25 = +75 Bs` (a resultado del periodo / Diferencia de precio de compra).
  - Valoración final en bodega: las 5 unidades que valían 5 * 125 = 625 Bs, al absorber +25 Bs, pasan a valer 650 Bs (nuevo costo promedio: 650 / 5 = 130 Bs).

---

## Fase 0: Esquema y correlativos

### Qué se construyó
- **Esquema de base de datos (`apps/api/prisma/schema.prisma`):**
  - Modelos `PurchaseInvoice` y `PurchaseInvoiceLine` con sus relaciones, importes y campos de tasas y diferencias (`priceDifference`, `exchangeDifference`).
  - Modelo `PurchaseOrderLine` ampliado con `invoicedQuantity` (`invoiced_quantity`).
  - Modelos `SupplierPayment` y `SupplierPaymentAllocation` para pagos a proveedor y asignaciones a facturas.
  - Modelos `SupplierCreditNote` y `SupplierCreditNoteLine` para notas de crédito a proveedor con soporte de acreditación de devolución y pago de emisión (`issuePaymentId`).
  - Modelo `Adjustment` ampliado con `originType` (`origin_type`) y `originId` (`origin_id`).
  - Modelo `AdjustmentLine` ampliado con `revaluationKind` (`revaluation_kind`: `cost` | `amount`), `amount`, `sourceMovementId` (`source_movement_id`), `stockPart` (`stock_part`) y `soldPart` (`sold_part`).
  - Relación `adjustmentLines` añadida en `InventoryMovement` para vincular movimientos de entrada con líneas de revaluación por importe.
- **Migración SQL (`apps/api/prisma/migrations/20261012000000_h9_purchases_and_payables/migration.sql`):**
  - Creación de enums `purchase_invoice_status` y `revaluation_kind`.
  - Creación de tablas, claves foráneas e índices.
  - Índice parcial único antifraude (H9 §3.1):
    ```sql
    CREATE UNIQUE INDEX "purchase_invoices_one_active_number_per_supplier"
      ON "purchase_invoices" ("tenant_id", "supplier_id", "supplier_invoice_number")
      WHERE "status" <> 'cancelled';
    ```
- **Correlativos y contexto `payables`:**
  - `PurchasingCodePrefix` ampliado con `'FCP'` en `apps/api/src/contexts/purchasing/domain/shared/code-sequence.ts`.
  - Estructura base de `payables` creada: `TenantId` VO, `PayablesCodeSequence` con prefijos `'PAG'` y `'NCP'`, `PrismaPayablesCodeSequence` y `InMemoryPayablesCodeSequence`.
  - Suite de pruebas unitarias: `apps/api/src/contexts/payables/domain/shared/code-sequence.spec.ts`.

### Reglas de H9 cubiertas
- **H9 §5.2 / §5.4:** Definición de modelos relacionales, campos de diferencias, líneas de revaluación por importe y prefijos de correlativos (`FCP`, `PAG`, `NCP`).
- **H9 §3.1:** Control de unicidad de número activo por proveedor mediante índice parcial SQL.

### Pruebas que lo defienden
- `apps/api/src/contexts/payables/domain/shared/code-sequence.spec.ts:6:  it('formats PAG with 6 digits')`
- `apps/api/src/contexts/payables/domain/shared/code-sequence.spec.ts:11:  it('formats NCP with 6 digits')`
- `apps/api/src/contexts/payables/domain/shared/code-sequence.spec.ts:15:  it('increments in-memory code sequence per tenant and prefix')`
- `apps/api/src/architecture.spec.ts` (911 pruebas verificando que las capas de dominio y aplicación no conocen dependencias externas ni capas superiores).

### Cómo se verificó
Ejecución de `make verify` con salida completa en `scratch/verify-fase0-1.log`:
```
7:35PM INF no leaks found
 Test Files  166 passed (166)
      Tests  3227 passed (3227)
 Test Files  24 passed (24)
      Tests  223 passed (223)
 Test Files  12 passed (12)
      Tests  275 passed (275)
  474 passed (9.5m)
  Todo en verde.
```
Verificación de deriva de esquema contra la base de datos de PostgreSQL:
```
No difference detected.
```

### Lo que no salió como decía el plan
Ninguno.

---

## Fase 1: Factura de compra (`FCP`)

### Qué se construyó
- **Dominio (`apps/api/src/contexts/purchasing/domain/invoice/`):**
  - Entidad `PurchaseInvoice` con ciclo de vida `draft` -> `confirmed` | `cancelled`, cálculo estricto de totales a partir de sus líneas sin capturarlos directamente (H9 §4.1 regla 5), validación de fechas (emisión no futura, vencimiento no anterior a emisión).
  - VO `SupplierInvoiceNumber`: normalización a mayúsculas y recorte de espacios en extremos para garantizar unicidad antifraude (`FAC-001` y `fac-001` equivalentes, H9 §3.1).
  - Entidad de línea `PurchaseInvoiceLine`: referencias a `receiptLineId`, `orderLineId` (servicios de orden) o concepto libre (gastos sin orden), importes `Decimal(18, 4)`.
  - Catálogo de 16 errores de dominio tipados y dados de alta en `error-categories.spec.ts` con `publicMessage` sin identificadores internos ni repetición de datos enviados.
- **Casos de uso (`apps/api/src/contexts/purchasing/application/`):**
  - `PurchaseInvoiceCreator`, `PurchaseInvoiceUpdater`, `PurchaseInvoiceConfirmer`, `PurchaseInvoiceCanceller`, `PurchaseInvoiceFinder`, `PurchaseInvoiceSearcher`.
  - Validación de proveedores activos, verificación de cupo disponible contra entradas (`recibido - devuelto - ya_facturado`) y contra servicios de órdenes (`pedido - ya_facturado`).
  - Al anular: reversión de `invoicedQuantity` en las líneas de orden de compra y liberación del número de factura del proveedor.
- **Persistencia y Concurrencia:**
  - `PrismaPurchaseInvoiceRepository` e `InMemoryPurchaseInvoiceRepository`.
  - `PrismaPurchaseInvoicePosting` con transacción atómica y orden estricto de bloqueo `FOR UPDATE`: Factura -> Entradas citadas (ordenadas por `id`) -> Órdenes (H9 §4.1 regla 3).
  - `InMemoryPurchaseInvoicePosting` con cola de ejecución serial.
- **API HTTP y Módulo NestJS:**
  - Controladores en `apps/api/src/contexts/purchasing/infrastructure/http/`: creación (POST), edición (PUT), confirmación (PUT), anulación (PUT), detalle (GET) y búsqueda paginada (GET).
  - DTOs Zod estrictos (`.strict()`) con validación de identificadores, números y fechas.
  - Permisos en minúsculas en catálogo (`apps/api/src/contexts/access/domain/role/permissions.catalog.ts`): `purchasing.invoices.create`, `purchasing.invoices.update`, `purchasing.invoices.confirm`, `purchasing.invoices.cancel`.
  - Validación de pertenencia de proveedor en `PurchaseInvoiceSearcher` (retorna 404 ante proveedores de otros tenants).
- **Frontend Web (`apps/web`):**
  - Sección «Facturas» agregada a navegación de Compras (`purchasing-sections.ts`).
  - Tipos `PurchaseInvoice`, `PurchaseInvoiceLine`, `PurchaseInvoiceStatus` y badges en `purchasing.ts`.
  - Métodos API en `purchasing-api.ts` e implementación en `http-purchasing-api.ts` con mapeo exacto de DTOs.
  - Pantalla principal `apps/web/src/app/(app)/compras/facturas/page.tsx` y componente `apps/web/src/sections/purchasing/purchase-invoices-board.tsx` con listado paginado, filtros, modal de nueva factura con selección de proveedor y líneas, acciones de confirmar y anular, y ocultamiento estricto de acciones para rol consulta.
- **Aislamiento Multitenant (`apps/e2e/support/isolation-matrix.ts`):**
  - 6 casos añadidos a la matriz de aislamiento para todas las rutas nuevas de facturas de compra.

### Reglas de H9 cubiertas
- **H9 §3.1:** Unicidad de número de factura por proveedor; normalización mayúsculas/espacios; anular libera número; mismo número en distinto proveedor permitido.
- **H9 §3.2:** Confirmar una factura de compra no altera ninguna existencia física en bodega.
- **H9 §3.4:** No facturar más de lo recibido ni facturar mercancía ya devuelta al proveedor.
- **H9 §3.5:** Cobertura de dos entradas en una misma factura y facturación parcial de una entrada en dos facturas.
- **H9 §3.6:** Facturación directa de servicios o gastos libres sin entrada de bodega.
- **H9 §4.1:** Reglas de validación al confirmar, derivación de totales, actualización de `invoicedQuantity` en orden y bloqueo ordenado concurrente.

### Pruebas que lo defienden
- `apps/api/src/contexts/purchasing/domain/invoice/purchase-invoice.entity.spec.ts:60:  it('creates draft purchase invoice and computes totals correctly')`
- `apps/api/src/contexts/purchasing/domain/invoice/purchase-invoice.entity.spec.ts:86:  it('normalizes supplier invoice number to uppercase without whitespace')`
- `apps/api/src/contexts/purchasing/domain/invoice/purchase-invoice.entity.spec.ts:91:  it('rejects invoice without lines')`
- `apps/api/src/contexts/purchasing/domain/invoice/purchase-invoice.entity.spec.ts:113:  it('rejects future issue date')`
- `apps/api/src/contexts/purchasing/domain/invoice/purchase-invoice.entity.spec.ts:135:  it('rejects due date earlier than issue date (H9 §4.1 regla 2)')`
- `apps/api/src/contexts/purchasing/domain/invoice/purchase-invoice.entity.spec.ts:182:  it('supports confirmation and cancellation lifecycle')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:337:  it('creates draft purchase invoice with correlative FCP and valid totals')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:362:  it('rejects duplicate invoice number for the same supplier (H9 §3.1)')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:395:  it('allows same invoice number for a different supplier (H9 §3.1)')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:428:  it('confirms invoice and updates order invoicedQuantity (H9 §4.1)')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:453:  it('rejects invoicing more quantity than available in receipt (H9 §3.4, §4.1 regla 3)')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:475:  it('invoicing direct service line marks invoiced and rejects exceeding ordered (H9 §4.1)')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:519:  it('confirms invoice of free expense without receipt or order (H9 §3.6)')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:537:  it('cancels confirmed invoice and returns invoiced quantities to order and frees supplier number (H9 §3.1, §4.1)')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:587:  it('rejects invoicing goods that were already returned (H9 §3.4)')`
- `apps/api/src/contexts/purchasing/application/purchase-invoice.spec.ts:702:  it('covers two receipts in one invoice, and one receipt split across two invoices (H9 §3.5)')`
- `apps/api/src/contexts/purchasing/testing/purchasing-ports.contract.ts:756:      it('saves and finds purchase invoice by id, code and search criteria')`
- `apps/api/src/contexts/purchasing/testing/purchasing-ports.contract.ts:772:      it('rejects duplicate active supplier invoice number for the same supplier')`
- `apps/api/src/contexts/purchasing/testing/purchasing-ports.contract.ts:787:      it('allows reusing supplier invoice number once the earlier invoice is cancelled')`
- `apps/api/src/contexts/purchasing/testing/purchasing-ports.contract.ts:806:      it('rejects invoicing more than received on a receipt line')`
- `apps/api/src/contexts/purchasing/testing/purchasing-ports.contract.ts:818:      it('cancelling a confirmed invoice reverts invoicedQuantity on the order')`
- `apps/api/src/contexts/purchasing/testing/purchasing-ports.contract.ts:837:      it('two simultaneous confirms compete: exactly one succeeds and one fails without exceeding receipt quantity')`
- `apps/api/src/contexts/purchasing/testing/purchasing-ports.contract.ts:864:      it('confirming a purchase invoice does not change any stock (H9 §3.2)')`
- `apps/e2e/tests/isolation/tenant-isolation.api.spec.ts:59:5`:
  - `the superuser, while working in Acme cannot create a purchase invoice for a supplier of another tenant`
  - `the superuser, while working in Acme cannot rewrite a draft purchase invoice of another tenant`
  - `the superuser, while working in Acme cannot confirm a purchase invoice of another tenant`
  - `the superuser, while working in Acme cannot cancel a purchase invoice of another tenant`
  - `the superuser, while working in Acme cannot find a purchase invoice of another tenant`
  - `the superuser, while working in Acme cannot filter the purchase invoices by a supplier of another tenant`

### Mutaciones probadas (H9 §7)
1. **Fila §3.1 (Duplicado proveedor):**
   - *Qué se quitó:* Comprobación `if (existing) throw new DuplicateSupplierInvoiceNumberError(...)` en `PurchaseInvoiceCreator`.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/application/purchase-invoice.spec.ts`
   - *Línea del fallo:* `src/contexts/purchasing/application/purchase-invoice.spec.ts:373:6`
     `AssertionError: promise resolved "PurchaseInvoice{ …(11) }" instead of rejecting`
2. **Fila §3.2 (No toca existencias):**
   - *Qué se quitó:* Expectativa en contrato de que la existencia tras confirmar no cambia (`stockAfterInvoice === initialStock + 10`).
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/infrastructure/testing/in-memory-purchasing-ports.contract.spec.ts -t "confirming a purchase invoice does not change any stock"`
   - *Línea del fallo:* `src/contexts/purchasing/testing/purchasing-ports.contract.ts:876:35`
     `AssertionError: expected 240 to be 250 // Object.is equality`
3. **Fila §4.1 (Servicio en orden no supera pedido):**
   - *Qué se quitó:* Validación `if (lineQty > available) throw new InvoiceQuantityExceedsOrderServiceError(...)` en posting.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/application/purchase-invoice.spec.ts`
   - *Línea del fallo:* `src/contexts/purchasing/application/purchase-invoice.spec.ts:497:6`
     `AssertionError: promise resolved "PurchaseInvoice{ …(11) }" instead of rejecting`
4. **Fila §3.4 (Facturar más de lo recibido o ya devuelto):**
   - *Qué se quitó:* Validación `if (lineQty > available) throw new InvoiceQuantityExceedsReceiptError(...)` en posting.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/application/purchase-invoice.spec.ts`
   - *Líneas del fallo:*
     - Exceso sobre recibo: `src/contexts/purchasing/application/purchase-invoice.spec.ts:453:6`
       `AssertionError: promise resolved "PurchaseInvoice{ …(11) }" instead of rejecting`
     - Facturar lo ya devuelto: `src/contexts/purchasing/application/purchase-invoice.spec.ts:661:6`
       `AssertionError: promise resolved "PurchaseInvoice{ …(11) }" instead of rejecting`
5. **Fila §3.5 (Una factura cubre dos entradas; una entrada en dos facturas):**
   - *Qué se alteró:* Rechazo artificial de facturas con más de 1 entrada (`if (distinctReceipts.size > 1) throw new Error(...)`).
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/application/purchase-invoice.spec.ts`
   - *Línea del fallo:* `src/contexts/purchasing/infrastructure/testing/in-memory-purchase-invoice-posting.ts:87:13`
     `Error: Only one receipt allowed per invoice`
6. **Fila §3.6 (Factura de sólo servicios sin entrada se confirma):**
   - *Qué se alteró:* Exigencia forzada de que toda factura deba contener al menos una línea con `receiptLineId`.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/application/purchase-invoice.spec.ts`
   - *Línea del fallo:* `src/contexts/purchasing/infrastructure/testing/in-memory-purchase-invoice-posting.ts:86:13`
     `Error: Only invoices with receipt lines are allowed`
7. **Fila §3.1 (`FAC-001` y `fac-001` normalización a mayúsculas):**
   - *Qué se quitó:* Llamada a `.toUpperCase()` en `SupplierInvoiceNumber.of`.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/domain/invoice/purchase-invoice.entity.spec.ts`
   - *Línea del fallo:* `src/contexts/purchasing/domain/invoice/purchase-invoice.entity.spec.ts:88:23`
     `AssertionError: expected 'fac-xyz-999' to be 'FAC-XYZ-999'`
8. **Fila §4.1 (Dos facturas confirmadas a la vez no suman por encima de lo recibido):**
   - *Qué se quitó:* Serialización en cola (`this.serial`) en `InMemoryPurchaseInvoicePosting.confirm` con delay forzado de concurrencia.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/infrastructure/testing/in-memory-purchasing-ports.contract.spec.ts -t "two simultaneous confirms compete"`
   - *Línea del fallo:* `src/contexts/purchasing/testing/purchasing-ports.contract.ts:855:34`
     `AssertionError: expected 2 to be 1 // Object.is equality`

### Cómo se verificó
1. **Corrida intermedia roja 1 (typecheck en verify):**
   ```
   apps/api typecheck: src/contexts/purchasing/application/purchase-invoice.spec.ts(36,10): error TS2305: Module '"./create-invoice/purchase-invoice-creator.js"' has no exported member 'CreatePurchaseInvoiceDraft'.
   apps/api typecheck: src/contexts/purchasing/application/purchase-invoice.spec.ts(70,7): error TS2420: Class 'TestRates' incorrectly implements interface 'DocumentRates'.
   apps/api typecheck: src/contexts/purchasing/infrastructure/testing/in-memory-purchase-invoice-posting.ts(32,44): error TS2552: Cannot find name 'PurchaseOrder'. Did you mean 'PurchaseOrderId'?
   apps/api typecheck: src/contexts/purchasing/testing/purchasing-ports.contract.ts(193,36): error TS2345: Property 'concept' is missing in type...
   make[1]: *** [Makefile:77: typecheck] Error 1
   make: *** [Makefile:99: verify] Error 2
   ```
2. **Corrida intermedia roja 2 (isolation en verify):**
   ```
   1) [isolation] › tests/isolation/tenant-isolation.api.spec.ts:59:5 › Tenant isolation: Acme cannot reach Globex › an Acme administrator cannot filter the purchase invoices by a supplier of another tenant
      Expected: 404
      Received: 200
   2) [isolation] › tests/isolation/tenant-isolation.api.spec.ts:59:5 › Tenant isolation: Acme cannot reach Globex › the superuser, while working in Acme cannot filter the purchase invoices by a supplier of another tenant
      Expected: 404
      Received: 200
   ```
3. **Corrida final verde (`make verify` en `scratch/verify-fase1.log`):**
   ```
   9:04PM INF no leaks found
    Test Files  168 passed (168)
         Tests  3325 passed (3325)
    Test Files  24 passed (24)
         Tests  224 passed (224)
    Test Files  12 passed (12)
         Tests  282 passed (282)
     ✓   10 [api] › tests/api/auth.api.spec.ts:119:3 › Brute force and timing › locks an account after five failed attempts, even for the right password (1.3s)
     ✓  221 [ui] › tests/ui/login.spec.ts:19:3 › Signing in › rejects a wrong password without saying which field failed (1.3s)
     486 passed (11.4m)
     Todo en verde.
   ```
4. **Pruebas en navegador con `playwright-cli` (headed y persistent, skill `web-qa`):**
   - Sesión en `http://localhost:3000`. Login con `ana@acme.com`.
   - Navegación a Compras -> Facturas. Creación de factura borrador y confirmación a estado `Confirmada`.
   - Captura: `docs/revision/h9/capturas/fase1-facturas.png`.
   - Login con usuario consulta `contador@externo.com`: verificado que no ve botón "Nueva factura" ni opciones de confirmación/anulación.
   - Captura: `docs/revision/h9/capturas/fase1-consulta-sin-acciones.png`.

### Lo que no salió como decía el plan
- En el endpoint de búsqueda `GET /api/v1/purchasing/invoices`, cuando se filtra por `supplierId`, el atacante de otro tenant recibía `200` con lista vacía en vez de `404 Not Found`. Se incorporó la validación con `SupplierFinder` en `PurchaseInvoiceSearcher` para lanzar `SupplierNotFoundError` (404) y preservar el aislamiento estricto de multitenencia.
- `purchaseInvoiceCreateSchema` utiliza nombres `supplierInvoiceNumber`, `supplierInvoiceSeries`, `issueDate`, `dueDate`, `taxRate` y `.strict()`. `http-purchasing-api.ts` requirió mapear exactamente estos nombres en lugar de aliases genéricos.

### Lo que quedó en FUTURE.md
Ninguno para esta fase.

---

## Fase 2 — Conciliación a tres bandas (`ThreeWayMatch`)

### Qué se construyó
- **Servicio de aplicación `ThreeWayMatcher`:**
  - `apps/api/src/contexts/purchasing/application/three-way-match/three-way-matcher.ts`: Compara orden, entrada y factura sin duplicar lógica de cupos; calcula cantidades pedidas, recibidas, devueltas, disponibles facturables y facturadas, así como diferencias de precio unitario y total.
  - `apps/api/src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts`: Pruebas exhaustivas para conciliación perfecta, diferencias de precio, exceso de cantidad sobre cupo disponible y líneas de servicio directo.
- **API y Controladores:**
  - `apps/api/src/contexts/purchasing/infrastructure/http/three-way-match-get.controller.ts`: Endpoint `GET /api/v1/purchasing/invoices/:invoiceId/three-way-match`.
  - `apps/e2e/support/isolation-matrix.ts`: Ruta incorporada en la matriz de aislamiento para validación estricta de multitenencia 404 entre empresas.
- **Web y UI:**
  - Contrato API en `purchasing-api.ts` y `http-purchasing-api.ts`, cubierto con prueba unitaria en `http-purchasing-api.spec.ts`.
  - Server Action `getPurchaseInvoiceThreeWayMatchAction` en `apps/web/src/app/(app)/compras/actions.ts`.
  - Acción "Conciliación (3-Way)" en la tabla de facturas de compra y modal SlideOver de Conciliación a tres bandas en `apps/web/src/sections/purchasing/purchase-invoices-board.tsx` con advertencias visuales y comparativa línea a línea.

### Qué reglas de H9 cubre
- **H9 §3.9 y Ajuste 1:** Conciliación a tres bandas que compara y devuelve diferencias de cantidades y precios contra la orden y la entrada usando el cupo de devolución, con API y pantalla visible antes de confirmar, alertando si hay exceso de cantidad o diferencia de precio.

### Pruebas que lo defienden
- `apps/api/src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts:164:  it('matches perfectly when quantity and price match receipt and order')`
- `apps/api/src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts:218:  it('detects price difference without exceeding quantity')`
- `apps/api/src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts:268:  it('detects quantity exceeding available return quota (H9 §3.9)')`
- `apps/api/src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts:317:  it('matches order direct service line against purchase order')`
- `apps/e2e/tests/isolation/tenant-isolation.api.spec.ts:469`:
  - `the superuser, while working in Acme cannot inspect three-way match of a purchase invoice of another tenant`

### Mutaciones probadas (H9 §7)
1. **Fila §3.9 (Detección de exceso de cantidad en conciliación):**
   - *Qué se quitó:* Asignación `quantityMismatch = lineQty > available` reemplazada por `quantityMismatch = false` en `ThreeWayMatcher`.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts`
   - *Línea del fallo:* `src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts:310:36`
     ```
     FAIL src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts > ThreeWayMatcher application service (H9 Fase 2) > detects quantity exceeding available return quota (H9 §3.9)
     AssertionError: expected false to be true // Object.is equality
     - Expected
     + Received
     - true
     + false
     ❯ src/contexts/purchasing/application/three-way-match/three-way-matcher.spec.ts:310:36
        308|     const match = await matcher.run(TENANT, invId.value);
        309|
        310|     expect(match.hasDiscrepancies).toBe(true);
           |                                    ^
        311|     expect(match.hasQuantityExceeded).toBe(true);
     ```

### Cómo se verificó
1. **Corrida intermedia roja (test-contract falló por orden de limpieza FK en harnesses):**
   ```
   FAIL src/contexts/sales/infrastructure/persistence/prisma-sales-ports.contract.integration.spec.ts > Sales ports contract: prisma
   PrismaClientKnownRequestError: 
   Invalid `this.prisma.supplier.deleteMany()` invocation in
   /home/medine01/dev/erp-portafolio/apps/api/src/contexts/sales/infrastructure/testing/prisma-sales-ports.harness.ts:124:32
   Foreign key constraint violated on the constraint: `purchase_invoices_tenant_id_supplier_id_fkey`
   ```
2. **Corrección aplicada:** Se agregaron `deleteMany` para `purchaseInvoiceLine` y `purchaseInvoice` antes de eliminar `supplier` en todos los harnesses de contrato de la base de datos (`sales`, `purchasing`, `reporting`, `inventory`, `catalog`, `access`) y en `seed.ts`.
3. **Corrida final verde (`make verify` en `scratch/verify-fase2.log`):**
   ```
   9:36PM INF no leaks found
    Test Files  169 passed (169)
         Tests  3332 passed (3332)
    Test Files  24 passed (24)
         Tests  224 passed (224)
    Test Files  12 passed (12)
         Tests  282 passed (282)
     ✓   10 [api] › tests/api/auth.api.spec.ts:119:3 › Brute force and timing › locks an account after five failed attempts, even for the right password (1.1s)
     ✓  221 [ui] › tests/ui/login.spec.ts:19:3 › Signing in › rejects a wrong password without saying which field failed (1.3s)
     488 passed (9.2m)
     Todo en verde.
   ```
4. **Pruebas en navegador con `playwright-cli` (headed y persistent, skill `web-qa`):**
   - Sesión en `http://localhost:3000`. Login con `ana@acme.com`.
   - Navegación a `/compras/facturas`.
   - Factura de prueba `FCP000001` desplegada.
   - Click en menú de opciones y click en "Conciliación (3-Way)".
   - Modal de conciliación desplegado con verificación exacta de cantidades y costos comparados.
   - Captura: `docs/revision/h9/capturas/fase2-conciliacion.png`.

### Lo que no salió como decía el plan
- Al incorporar la foreign key de `PurchaseInvoice` a `Supplier`, cualquier registro residual en `PurchaseInvoice` bloqueaba el `deleteMany` de `Supplier` en los harnesses de prueba de contrato. Se corrigió actualizando la cadena de limpieza en los 7 harnesses de persistencia y en `seed.ts`.

### Lo que quedó en FUTURE.md
Ninguno para esta fase.

---

## Fase 3 — La diferencia de precio y revaluación por importe

### Qué se construyó
- **Dominio de Inventario (`apps/api/src/contexts/inventory/domain/`):**
  - `AdjustmentLine`: ampliado para soportar `revaluationKind: 'cost' | 'amount'`, `amount`, `sourceMovementId`, `stockPart`, `soldPart` y método `allocateVariance(stockPart, soldPart, newUnitCost?)`.
  - `Adjustment`: soporte de `originType: 'purchase_invoice'`, `originId` y `toPrimitives()`.
  - `PriceVariance` (`apps/api/src/contexts/inventory/domain/stock/price-variance.ts`): servicio de reparto dinámico del importe de revaluación según el estado del kardex en el momento de la aprobación. Cada salida posterior reduce la proporción en `(qtyAfter / qtyBefore)`, excluyendo las devoluciones a proveedor de esa misma entrada (`purchase_return` citando `sourceMovementId`).
  - `StockMovements`: puerto en inventario ampliado con `movementsSince(tenantId, sourceMovementId)` para consultar movimientos posteriores desde una entrada dada. Implementado en `InMemoStockMovements` y `PrismaStockMovements`.
  - `AdjustmentConfirmation`: ampliado para invocar `PriceVariance` cuando el ajuste tiene líneas por importe (`revaluationKind === 'amount'`), actualizando `stockPart` y `soldPart`, y ajustando el kardex solo para la parte de stock.
- **Dominio de Compras (`apps/api/src/contexts/purchasing/domain/`):**
  - `PurchasePriceDifference` (`apps/api/src/contexts/purchasing/domain/invoice/purchase-price-difference.ts`): servicio que calcula la diferencia de precio en la moneda del documento y la convierte a la moneda base de la empresa con las tasas de la entrada (`priceDifferenceBase`), y calcula la diferencia en cambio (`exchangeDifferenceBase`) sin tocar inventario.
  - Puerto `INVOICE_REVALUATION_POSTING` (`apps/api/src/contexts/purchasing/domain/invoice/invoice-revaluation-posting.ts`) para creación de revaluaciones en borrador desde compras sin acoplamiento hexagonal.
- **Persistencia y Adaptadores:**
  - `PrismaInvoiceRevaluationPosting` e `InMemoryInvoiceRevaluationPosting`: implementan la creación de revaluaciones en borrador (una por bodega citada) al confirmar la factura y el descarte/reversión al anular la factura.
  - Integración en `PrismaPurchaseInvoicePosting` e `InMemoryPurchaseInvoicePosting` en la misma transacción atómica de confirmación/anulación de la factura.
  - Migración SQL ajustada con check constraint `adjustment_lines_quantity_positive` para admitir `(unit_cost IS NOT NULL OR amount IS NOT NULL)` cuando `quantity = 0`.
- **UI y Pantalla de Ajustes (Ajuste 3 del usuario):**
  - `AdjustmentSearcher`: expone `originType`, `originId`, `originCode` (`FCP...`) y propiedades de revaluación por importe (`amount`, `revaluationKind`, `stockPart`, `soldPart`).
  - `apps/web/src/modules/inventory/domain/inventory.ts`: `summarizeLines` actualizado para líneas por importe: muestra `Revaluación +20,00 (FCP000001) SKU`, enseñando su origen por el código de la factura, nunca un id interno.
  - `adjustments-board.tsx`: visualización del código de origen `FCP...` en la tabla de ajustes.

### Reglas de H9 cubiertas
- **H9 §3.3:** Diferencia de precio se mide en moneda del documento y se lleva a la empresa a las tasas de la entrada; diferencia en cambio en `exchangeDifference`; revaluación en borrador con líneas por importe citando el movimiento de entrada; reparto dinámico al aprobar (`stockPart` a inventario, `soldPart` a resultado).
- **H9 §4.1:** Al anular factura: si el ajuste está en borrador se cancela/descarta; si ya estaba confirmado se crea revaluación reversa en borrador con importe opuesto (`-amount`).
- **Ajuste 3 del usuario:** Puerto `INVOICE_REVALUATION_POSTING` en compras con adaptador y contrato contra PostgreSQL y doble in-memory. En la pantalla de Ajustes, la línea por importe enseña su origen por el código de la factura (`FCP...`), nunca un id.
- **Ajuste 4 del usuario:** Caso de devoluciones a proveedor de OTRAS entradas analizado y cubierto con prueba unitaria dedicada.

### Pruebas que lo defienden
- `apps/api/src/contexts/inventory/domain/stock/price-variance.spec.ts:49: describe('calculatePriceVariance (H9 §3.3 & §5.3)')`:
  - `keeps 100% in stock if there were no subsequent exits`
  - `allocates 100% to sold/cogs if stock was completely exhausted`
  - `handles negative price variance (cheaper invoice than receipt)`
  - `calculates correctly when units sold between invoice and approval (10 at 100, invoice 110, 6 sold => +40 stock, +60 sold)`
  - `incoming stock after sale does not reduce original ratio (10 at 100, 6 sold, 10 at 90 enter => +40 to stock for 14 units)`
  - `handles two entries before invoicing (10 at 100, 10 at 150, 15 sold, invoice first lot at 110 => +25 stock, +75 sold)`
  - `purchase return of the same receipt does not count as exit in variance allocation`
  - `Ajuste 4 del usuario: return of ANOTHER receipt and variance allocation`
- `apps/api/src/contexts/purchasing/domain/invoice/purchase-price-difference.spec.ts:10: describe('calculatePurchasePriceDifference (H9 §3.3)')`:
  - `computes zero price difference and full exchange difference when prices match in USD but rate changed (H9 §7)`
  - `computes price difference in base currency when invoice is more expensive at same exchange rate`
  - `computes negative price difference when invoice is cheaper`
  - `combines price difference and exchange difference simultaneously`
- `apps/api/src/contexts/purchasing/testing/purchasing-ports.contract.ts`:
  - `creates draft revaluation adjustment when invoiced price differs from receipt (H9 §4.1, Ajuste 3)`
  - `cancels draft revaluation adjustment when invoice is cancelled (H9 §4.1)`

### Ajuste 4 del usuario (Devoluciones de OTRAS entradas)
- **Escenario probado:**
  - Entrada 1 (origen a revaluar): 10 unidades a 100 (Total = 1.000). Monto a revaluar: +100 (factura a 110).
  - Entrada 2 (otra entrada): 10 unidades a 150 (Total = 1.500). Existencia = 20, promedio = 125.
  - Devolución a proveedor de 5 unidades de la Entrada 2: en el kardex sale al costo congelado de la Entrada 2 (150). Existencia antes = 20, existencia después = 15.
- **Resultado de la fórmula actual de PriceVariance:**
  - `ratio = 15 / 20 = 0.75`
  - `stockPart = 75`, `soldPart = 25`
- **Cifra teórica exacta:**
  - Dado que la devolución fue de la Entrada 2 (ninguna unidad de la Entrada 1 se devolvió ni se vendió), las 10 unidades de la Entrada 1 permanecen 100% en bodega.
  - Teóricamente: `stockPart = 100`, `soldPart = 0`.
- **Diferencia observada:** 25 unidades monetarias. Queda documentada entre las dudas y notas de diseño para H10 sin alterar la fórmula actual según la instrucción explícita del usuario.

### Mutaciones probadas (H9 §7)
1. **Fila §3.3 (Devolución de la misma entrada no cuenta como salida):**
   - *Qué se quitó:* Condición `if (mov.origin.type === 'purchase_return' && mov.restoresMovementId?.value === sourceMovementId) continue;` en `PriceVariance`.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/inventory/domain/stock/price-variance.spec.ts`
   - *Línea del fallo:* `src/contexts/inventory/domain/stock/price-variance.spec.ts:190:27`
     `AssertionError: expected 70 to be 100 // Object.is equality`
2. **Fila §3.3 (Factura en USD al mismo precio pero distinta tasa):**
   - *Qué se alteró:* Cálculo de `exchangeDiffBase` forzado a `0` en `PurchasePriceDifference`.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/domain/invoice/purchase-price-difference.spec.ts`
   - *Línea del fallo:* `src/contexts/purchasing/domain/invoice/purchase-price-difference.spec.ts:20:36`
     `AssertionError: expected +0 to be 500 // Object.is equality`

### Cómo se verificó
1. **Corridas intermedias rojas:**
   - Fallo en contrato PostgreSQL (`test-contract`):
     `AssertionError: expected 730 to be 20` debido a que `rec.exchange_rate` en la BD registraba la tasa contra VES (36.5) y requería aplicar `effectiveRateToBase` respecto a la moneda de la empresa (`baseCurrency`). Corregido calculando `effectiveRateToBase`.
   - Fallo en build de contenedores (`make up`):
     Ruta de import de `TenantId` en `invoice-revaluation-posting.ts`, decorador metadata `import type` en `prisma-purchase-invoice-posting.ts` y missing import de `ThreeWayMatcher` en `purchasing.module.ts`. Corregidos y verificados con `pnpm --filter api build` y `pnpm --filter web build`.
   - Fallo en typecheck (`make verify`):
     Propiedad privada `priceDifference` en `PurchaseInvoice`. Corregido añadiendo getters públicos `get priceDifference()` y `get exchangeDifference()`.
2. **Corrida final verde (`make verify` en `docs/revision/h9/logs/verify-fase3-2.log`):**
   ```
   Test Files  12 passed (12)
        Tests  284 passed (284)
   488 passed (13.2m)
   Todo en verde.
   ```
3. **Pruebas en navegador con `playwright-cli` (headed y persistent, skill `web-qa`):**
   - Sesión en `http://localhost:3000`. Login con `ana@acme.com`.
   - Navegación a `/inventario/ajustes`.
   - Verificada la tabla de ajustes mostrando líneas de revaluación y origen sin identificadores internos.
   - Captura: `docs/revision/h9/capturas/fase3-revaluacion.png`.

### Lo que no salió como decía el plan
- Al añadir la columna `sourceMovementId` en `adjustment_lines`, cualquier movimiento citado por un ajuste impedía `inventoryMovement.deleteMany()` en los harnesses de prueba. Se actualizó el orden de borrado eliminando primero `adjustmentLine` y `adjustment` en los 7 harnesses de persistencia (`purchasing`, `reporting`, `inventory-ports`, `item-ports`, `catalog`, `access`, `company`).
- El cálculo de tasas multimoneda requirió calcular la tasa efectiva respecto a la moneda base de la empresa (`effectiveRateToBase`), evitando multiplicar tasas absolutas de BCV cuando el documento y la empresa comparten la misma moneda.

---


## Fase 4: Pago a proveedor (PAG)

### Qué se construyó
- **Contexto de Dominio (`apps/api/src/contexts/payables`):**
  - Value Objects y Agregados: `SupplierPayment` (`supplier-payment.entity.ts`), `PayablesDate` (`payables-date.vo.ts`), `PayableInvoice` (`payable-invoice.ts`).
  - Errores de Dominio: Jerarquía completa en `payables.errors.ts` y suite exhaustiva de categorización de errores (`error-categories.spec.ts`, 51 tests cubriendo `NotFound`, `Validation`, `Conflict` y `Forbidden`).
  - Puertos de Dominio: `SupplierPaymentRepository`, `PayablesLedger`, `SupplierPaymentPosting`.
- **Capa de Aplicación:**
  - Casos de uso: `PaymentCreator`, `PaymentUpdater`, `PaymentConfirmer`, `PaymentCanceller`, `PaymentSearcher`.
  - Suite de ciclo completo de pagos: `payables-cycle.spec.ts` (7 pruebas unitarias).
- **Capa de Infraestructura y Persistencia:**
  - Adaptadores Prisma: `PrismaSupplierPaymentRepository`, `PrismaPayablesLedger`, `PrismaSupplierPaymentPosting` con bloqueo transaccional concurrente (`FOR UPDATE`).
  - Contrato de puertos: `payables-ports.contract.ts` implementado y ejecutado contra:
    - Doble en memoria: `in-memory-payables-ports.contract.spec.ts` (8 pruebas).
    - PostgreSQL real: `prisma-payables-ports.contract.integration.spec.ts` (8 pruebas, cubriendo transaccionalidad, serialización y validaciones).
- **Capa HTTP y Módulo NestJS:**
  - DTOs y validaciones Zod: `payment.request.dto.ts`, `payment.query.dto.ts`.
  - Controladores:
    - `POST /api/v1/payables/payments` (`CreatePaymentPostController`)
    - `PUT /api/v1/payables/payments/:paymentId` (`UpdatePaymentPutController`)
    - `PUT /api/v1/payables/payments/:paymentId/confirm` (`ConfirmPaymentPutController`)
    - `PUT /api/v1/payables/payments/:paymentId/cancel` (`CancelPaymentPutController`)
    - `GET /api/v1/payables/payments` (`SearchPaymentsGetController`)
  - Módulo `payables.module.ts` registrado en `app.module.ts`.
- **Permisos y Aislamiento (Ajuste 6 del usuario):**
  - Catálogo de permisos: añadidos 5 permisos en `PAYABLES_PERMISSIONS` (`payables.payments.search`, `create`, `update`, `confirm`, `cancel`). Total: 114 permisos sincronizados.
  - Matriz de aislamiento (`apps/e2e/support/isolation-matrix.ts`): añadidas las 5 rutas de pagos y verificadas con `isolation-coverage.spec.ts` y `tenant-isolation.api.spec.ts` (pruebas 475 a 479 pasando con 404 para inquilinos ajenos).
- **Interfaz de Usuario Web (`apps/web`):**
  - Módulo `payables`: navegación secundaria (`payables-sections.ts`), tipos y helpers (`payables.ts`), traductor de errores en español (`payables-error.ts`), cliente HTTP (`http-payables-api.ts`), helper de sesión (`payables-api.ts`).
  - Componente visual `PaymentsBoard` (`apps/web/src/sections/payables/payments-board.tsx`): tabla con estados y montos, filtros por proveedor, estado y fechas, slide-over para crear/editar con selector de proveedor y asignación de facturas con saldo, opciones de confirmación y anulación.
  - Server Actions en `apps/web/src/app/(app)/cuentas-por-pagar/actions.ts`.
  - Rutas: `/cuentas-por-pagar/layout.tsx`, `/cuentas-por-pagar/page.tsx`, `/cuentas-por-pagar/pagos/page.tsx`.
  - Integración en navegación global: `Sidebar` y `AppLayout` con enlace directo y activo a `Cuentas por pagar`.

### Reglas de H9 cubiertas
- **H9 §4.2:** El borrador no toca saldos ni contabilidad. Confirmar el pago reduce el saldo de las facturas asignadas (`balance = total - paid`). Anular el pago devuelve el saldo a las facturas.
- **H9 §4.2:** Pagar más que el saldo se rechaza (`PaymentExceedsBalanceError`); pagar facturas de otro proveedor se rechaza (`InvoiceOfAnotherSupplierError`).
- **H9 §4.2:** Control de concurrencia: dos pagos concurrentes que compiten por el mismo saldo de una factura se serializan con bloqueo transaccional, impidiendo sobrepagos.
- **Ajuste 6 del usuario:** Rutas añadidas a la matriz de aislamiento, permisos en minúsculas y botones de acción protegidos según el rol.

### Pruebas que lo defienden
- `src/contexts/payables/domain/ledger/payable-invoice.spec.ts` (8 pruebas unitarias).
- `src/contexts/payables/domain/payment/supplier-payment.entity.spec.ts` (12 pruebas unitarias).
- `src/contexts/payables/application/payables-cycle.spec.ts` (7 pruebas unitarias).
- `src/contexts/payables/domain/errors/error-categories.spec.ts` (51 pruebas de categorización).
- `src/contexts/payables/infrastructure/testing/in-memory-payables-ports.contract.spec.ts` (8 pruebas de contrato en memoria).
- `src/contexts/payables/infrastructure/persistence/prisma-payables-ports.contract.integration.spec.ts` (8 pruebas de contrato en PostgreSQL real).
- `tests/isolation/tenant-isolation.api.spec.ts:59:5` (pruebas 475 a 479 de aislamiento para pagos).

### Mutaciones probadas (H9 §7)
1. **Fila §4.2 (Pagar más que el saldo se rechaza):**
   - *Qué se quitó:* Validación `if (amount > this.balanceUnits()) throw new PaymentExceedsBalanceError(...)` en `PayableInvoice.ensureAccepts`.
   - *Prueba corrida:* `pnpm --filter api test payable-invoice.spec.ts`
   - *Línea del fallo:* `src/contexts/payables/domain/ledger/payable-invoice.spec.ts:71:7`
     ```
     FAIL src/contexts/payables/domain/ledger/payable-invoice.spec.ts > PayableInvoice > rejects payments that exceed the remaining balance
     AssertionError: expected function to throw an error, but it didn't
      ❯ src/contexts/payables/domain/ledger/payable-invoice.spec.ts:71:7
          69| expect(() =>
          70| invoice.ensureAccepts(INVOICE_ROW.supplierId, PayablesDate.of('2…
          71| ).toThrow(PaymentExceedsBalanceError);
            | ^
     ```
2. **Fila §4.2 (Pagar facturas de otro proveedor se rechaza):**
   - *Qué se quitó:* Validación `if (this.row.supplierId !== supplierId) throw new InvoiceOfAnotherSupplierError(...)` en `PayableInvoice.ensureAccepts`.
   - *Prueba corrida:* `pnpm --filter api test payable-invoice.spec.ts`
   - *Línea del fallo:* `src/contexts/payables/domain/ledger/payable-invoice.spec.ts:56:7`
     ```
     FAIL src/contexts/payables/domain/ledger/payable-invoice.spec.ts > PayableInvoice > rejects payments for another supplier
     AssertionError: expected function to throw an error, but it didn't
      ❯ src/contexts/payables/domain/ledger/payable-invoice.spec.ts:56:7
          54| expect(() =>
          55| invoice.ensureAccepts('e8222222-2222-4222-8222-222222222222', Pa…
          56| ).toThrow(InvoiceOfAnotherSupplierError);
            | ^
     ```

### Cómo se verificó
1. **Corridas intermedias corregidas:**
   - Error de compilación en `in-memory-payables-store.ts` (`Type 'unknown' is not assignable to type 'void'`): corregido sustituyendo `return this.queue` por `await this.queue`.
   - Error de tipos en `http-payables-api.ts` y props de `Pager` en `payments-board.tsx`: corregidos alineándose con `AccessError.fromStatus` y `count`/`href`.
2. **Corrida final verde (`make verify` en `docs/revision/h9/logs/verify-fase4-1.log`):**
   ```
   Test Files 177 passed (177)
        Tests 3493 passed (3493)
   Test Files 24 passed (24)
        Tests 229 passed (229)
   Test Files 13 passed (13)
        Tests 292 passed (292)
   498 passed (11.4m)
   Todo en verde.
   ```
3. **Pruebas en navegador con `playwright-cli` (headed y persistent, skill `web-qa`):**
   - Sesión abierta con `playwright-cli -s=nexora open http://localhost:3000 --headed --persistent`.
   - Inicio de sesión anunciado y completado con `ana@acme.com`.
   - Navegación a `http://localhost:3000/cuentas-por-pagar/pagos`.
   - Apertura del panel "Nuevo pago" y verificación visual de la interfaz.
   - Captura guardada en: `docs/revision/h9/capturas/fase4-pagos.png`.
   - Sesión cerrada con `playwright-cli -s=nexora close`.

### Lo que no salió como decía el plan
- En `InMemoryPayablesStore`, encapsular el retorno de promesas en `this.queue` requirió `await` explícito para cumplir estrictamente con la firma `Promise<void>` de TypeScript bajo `noImplicitReturns`.
- Los adaptadores web y clientes HTTP requirieron ajustar el mapeo de `AccessErrorBody` con la función auxiliar `errorBodyOf`, garantizando que las respuestas de error de la API se traduzcan limpiamente sin advertencias de tipos.

---

## Fase 5: Saldo, antigüedad y estado de cuenta (`PayableBalances`)

### Qué se construyó
- **Dominio (`apps/api/src/contexts/payables/domain/aging/`):**
  - Módulo puro `aging.ts` y cálculo de tramos de vencimiento: `current`, `days1To30`, `days31To60`, `days61To90`, `over90`.
  - Función `bucketOf(invoice, today)`: asignación estricta de tramo según `daysOverdue`, retornando `null` para facturas con saldo cero o anuladas.
  - Función `agingOf(invoices, today, decimals)`: consolidación de totales por tramo reexpresados a la moneda principal de la empresa.
- **Casos de uso (`apps/api/src/contexts/payables/application/`):**
  - `PayableInvoiceSearcher`: consulta y filtrado de facturas por pagar con cálculo dinámico de saldo pendiente, días de vencimiento y tramo asignado (`bucket`). Ocultamiento o filtrado opcional de facturas ya saldadas o solo vencidas.
  - `SupplierBalanceSearcher`: consolidación de saldos por proveedor, cálculo de importe vencido, tramos de antigüedad y totales globales de la empresa.
  - `SupplierStatementSearcher`: reconstrucción cronológica del estado de cuenta de un proveedor con saldo progresivo (*running balance*) combinando facturas y cobros/pagos confirmados.
- **API HTTP y DTOs (`apps/api/src/contexts/payables/infrastructure/http/`):**
  - `SearchPayableInvoicesGetController` (`GET /api/v1/payables/invoices`): consulta de facturas por pagar con filtros por proveedor, estado, rango de fechas y solo vencidas.
  - `SearchSupplierBalancesGetController` (`GET /api/v1/payables/suppliers`): listado de proveedores con saldo, importes vencidos y desglose por antigüedad.
  - `SearchSupplierStatementGetController` (`GET /api/v1/payables/suppliers/:supplierId/statement`): estado de cuenta histórico de un proveedor con movimientos cronológicos y saldo acumulado.
  - DTOs Zod validados (`payable-invoice.query.dto.ts`, `supplier-balance.query.dto.ts`).
  - Mapeo en `PayablesModule` con guardianes de autenticación y permisos.
- **Permisos y Aislamiento Multitenant:**
  - Permisos sincronizados: `payables.balances.search` y `payables.statements.search` (116 permisos totales en el sistema).
  - Rutas integradas en `isolation-matrix.ts` y verificadas en `tenant-isolation.api.spec.ts` (pruebas 482 y 483 pasando).
- **Frontend Web (`apps/web`):**
  - Tipos en `payables.ts`: `PayableInvoice`, `SupplierBalance`, `Statement`, `StatementMovement`, `AGING_COLUMNS`.
  - Métodos API en `payables-api.ts` e implementación en `http-payables-api.ts`.
  - Componentes de interfaz:
    - `PayablesTable` (`apps/web/src/sections/payables/payables-table.tsx`): tabla paginada de facturas con filtros interactivos, indicador de vencimiento y estado.
    - `AgingTable` (`apps/web/src/sections/payables/aging-table.tsx`): tabla de antigüedad por proveedor con columnas por tramo y fila de totales globales.
    - `StatementView` (`apps/web/src/sections/payables/statement-view.tsx`): vista de movimientos cronológicos y saldo progresivo con selección de proveedor.
  - Páginas Next.js registradas:
    - `/cuentas-por-pagar/facturas` (`apps/web/src/app/(app)/cuentas-por-pagar/facturas/page.tsx`).
    - `/cuentas-por-pagar/antiguedad` (`apps/web/src/app/(app)/cuentas-por-pagar/antiguedad/page.tsx`).
    - `/cuentas-por-pagar/estado-de-cuenta` (`apps/web/src/app/(app)/cuentas-por-pagar/estado-de-cuenta/page.tsx`).

### Reglas de H9 cubiertas
- **H9 §4.3:** El saldo de cada factura es su total menos lo abonado en pagos confirmados; las facturas anuladas tienen saldo cero; los tramos de antigüedad agrupan estrictamente por días transcurridos desde la fecha de vencimiento (`current`, `days1To30`, `days31To60`, `days61To90`, `over90`).
- **Ajuste 6 del usuario:** Rutas de saldos y estados de cuenta añadidas a la matriz de aislamiento multitenant y protegidas por permisos específicos.

### Pruebas que lo defienden
- `src/contexts/payables/domain/aging/aging.spec.ts` (9 pruebas unitarias de cálculo puro).
- `src/contexts/payables/application/payables-balances.spec.ts` (7 pruebas unitarias de búsqueda, saldos y estado de cuenta).
- `src/contexts/access/infrastructure/http/route-declaration.spec.ts` (150 pruebas de rutas y permisos requeridos).
- `tests/isolation/tenant-isolation.api.spec.ts:59:5` (pruebas 482 y 483 de aislamiento para saldos y estados de cuenta).

### Mutaciones probadas (H9 §7)
1. **Fila §4.3 (Los tramos de antigüedad agrupan por días de vencimiento):**
   - *Qué se alteró:* En `apps/api/src/contexts/payables/domain/aging/aging.ts`, se mutó `if (days <= 30) return 'days1To30';` a `if (days <= 30) return 'days31To60';`.
   - *Prueba corrida:* `pnpm --filter api test aging.spec.ts payables-balances.spec.ts`
   - *Líneas del fallo:*
     - `src/contexts/payables/application/payables-balances.spec.ts:110:41`:
       ```
       FAIL src/contexts/payables/application/payables-balances.spec.ts > payables balances and statements > PayableInvoiceSearcher > returns all payable invoices ordered by due date
       AssertionError: expected 'days31To60' to be 'days1To30' // Object.is equality
       Expected: "days1To30"
       Received: "days31To60"
        ❯ src/contexts/payables/application/payables-balances.spec.ts:110:41
           108| expect(result.invoices.map((i) => i.code)).toEqual(['FCP000003',…
           109| expect(result.invoices[0].daysOverdue).toBe(19);
           110| expect(result.invoices[0].bucket).toBe('days1To30');
              |                                  ^
       ```
     - `src/contexts/payables/domain/aging/aging.spec.ts:56:40`:
       ```
       FAIL src/contexts/payables/domain/aging/aging.spec.ts > payables aging > classifies 1 to 30 days overdue in days1To30
       AssertionError: expected 'days31To60' to be 'days1To30' // Object.is equality
       Expected: "days1To30"
       Received: "days31To60"
        ❯ src/contexts/payables/domain/aging/aging.spec.ts:56:40
            54| it('classifies 1 to 30 days overdue in days1To30', () => {
            55|   const overdue10 = invoice({ dueDate: '2026-09-10', total: 100 });
            56|   expect(bucketOf(overdue10, TODAY)).toBe('days1To30');
              |                                      ^
       ```

### Cómo se verificó
1. **Corridas intermedias corregidas:**
   - La suite `route-declaration.spec.ts` detectó 5 permisos no mapeados de `creditnotes` agregados anticipadamente; se ajustó el catálogo para mantener estrictamente los permisos que cuentan con controladores activos en la fase actual.
2. **Corrida final verde (`make verify` en `docs/revision/h9/logs/verify-fase5-2.log`):**
   ```
   Test Files 178 passed (178)
        Tests 3534 passed (3534)
   Test Files 24 passed (24)
        Tests 229 passed (229)
   Test Files 13 passed (13)
        Tests 292 passed (292)
   502 passed (8.5m)
   Todo en verde.
   ```
3. **Pruebas en navegador con `playwright-cli` (headed y persistent, skill `web-qa`):**
   - Sesión abierta con `playwright-cli -s=nexora open http://localhost:3000 --headed --persistent`.
   - Inicio de sesión anunciado con `admin@nexora.com`.
   - Navegación y verificación visual en `/cuentas-por-pagar/facturas` y `/cuentas-por-pagar/antiguedad`.
   - Captura guardada en: `docs/revision/h9/capturas/fase5-saldos.png`.
   - Sesión cerrada con `playwright-cli -s=nexora close`.

### Lo que no salió como decía el plan
- Los permisos de notas de crédito a proveedores debieron posponerse al catálogo de la Fase 7 para mantener la invariante arquitectónica de que cada permiso declarado en el catálogo cuente con una ruta consumidora activa.

---

## Fase 6: Servicios y gastos

### Qué se construyó
- **Dominio (`apps/api/src/contexts/purchasing/domain/invoice/`):**
  - Soporte explícito en `PurchaseInvoiceLine` para facturación de servicios que provienen de una orden de compra (`orderLineId` informado, `receiptLineId: null`) y gastos directos libres (`concept` libre, sin `orderLineId` ni `receiptLineId`).
  - Validación de que los servicios y gastos directos no exigen entrada física ni mueven inventario, devengan cuenta por pagar y calculan su alícuota de impuesto (`taxRate`) con precisión.
  - Al anular una factura con líneas de servicio, se reintegra `invoicedQuantity` en la orden de compra original, permitiendo volver a facturar el servicio.
- **Casos de uso y Pruebas (`apps/api/src/contexts/purchasing/application/services-and-expenses.spec.ts`):**
  - Nueva suite dedicada con 5 pruebas exhaustivas:
    - Facturación parcial de servicios de orden: actualiza `invoicedQuantity` en la orden de compra.
    - Rechazo al superar la cantidad pedida de servicio en la orden (`InvoiceQuantityExceedsOrderServiceError`).
    - Anulación de factura de servicio: reintegra las cantidades facturadas a la orden de compra.
    - Facturación de gastos directos sin orden ni entrada: cálculo correcto de subtotales, impuestos y totales.
    - Facturación combinada en una sola factura con líneas de servicio de orden y conceptos libres.
- **Frontend Web (`apps/web`):**
  - En `PurchaseInvoicesBoard` (`apps/web/src/sections/purchasing/purchase-invoices-board.tsx`), soporte interactivo para agregar líneas de gastos directos (`+ Gasto/Concepto`) con `add-expense-line-button`, permitiendo capturar concepto libre, cantidad, costo unitario e IVA.
  - Verificación visual de modal y formulario en navegador con captura de pantalla.

### Reglas de H9 cubiertas
- **H9 §3.6:** Se puede facturar sin entrada: facturación directa de servicios de orden y de conceptos o gastos libres sin entrada de bodega.
- **H9 §4.1:** Una línea de servicio que cita una orden marca lo facturado en la orden y rechaza facturar por encima de lo pedido; al anular se devuelven las cantidades a la orden.
- **H9 §3.2:** Ni los servicios ni los gastos libres generan movimientos de existencia en bodega ni revaluaciones de inventario.

### Pruebas que lo defienden
- `src/contexts/purchasing/application/services-and-expenses.spec.ts` (5 pruebas unitarias y de integración).
- `src/contexts/purchasing/application/purchase-invoice.spec.ts` (10 pruebas unitarias del ciclo de facturas).

### Mutaciones probadas (H9 §7)
1. **Fila §4.1 (Una línea de servicio que cita una orden marca lo facturado y no supera lo pedido):**
   - *Qué se alteró:* En `apps/api/src/contexts/purchasing/infrastructure/testing/in-memory-purchase-invoice-posting.ts`, se desactivó la validación de cupo disponible del servicio mutando `if (lineQty > available)` por `if (false as boolean && lineQty > available)`.
   - *Prueba corrida:* `pnpm --filter api test services-and-expenses.spec.ts purchase-invoice.spec.ts`
   - *Líneas del fallo:*
     - `src/contexts/purchasing/application/purchase-invoice.spec.ts:516:6`:
       ```
       FAIL src/contexts/purchasing/application/purchase-invoice.spec.ts > PurchaseInvoice application services (H9 Fase 1) > invoicing direct service line marks invoiced and rejects exceeding ordered (H9 §4.1)
       AssertionError: promise resolved "PurchaseInvoice{ …(11) }" instead of rejecting
        ❯ src/contexts/purchasing/application/purchase-invoice.spec.ts:516:6
           514| await expect(
           515|   confirmer.run({ tenantId: TENANT, invoiceId: invoiceExceedingSrv…
           516| ).rejects.toThrow(InvoiceQuantityExceedsOrderServiceError);
              |  ^
       ```
     - `src/contexts/purchasing/application/services-and-expenses.spec.ts:378:6`:
       ```
       FAIL src/contexts/purchasing/application/services-and-expenses.spec.ts > Services and Free Expenses Invoicing (H9 §3.6, §4.1, §4.4) > rejects invoicing more service quantity than remaining on the purchase order (H9 §4.1)
       AssertionError: promise resolved "PurchaseInvoice{ …(11) }" instead of rejecting
        ❯ src/contexts/purchasing/application/services-and-expenses.spec.ts:378:6
           376| await expect(
           377|   confirmer.run({ tenantId: TENANT, invoiceId: invoice2.id.value }…
           378| ).rejects.toThrow(InvoiceQuantityExceedsOrderServiceError);
              |  ^
       ```

### Cómo se verificó
1. **Corridas intermedias corregidas:**
   - En `services-and-expenses.spec.ts`, se corrigieron los tipos de import (`PurchasableItem`), la llamada a `PurchaseOrder.draft` con el parámetro de fecha de negocio, y las propiedades requeridas de `SupplierPrimitives`.
2. **Corrida final verde (`make verify` en `docs/revision/h9/logs/verify-fase6-1.log`):**
   ```
   Test Files 180 passed (180)
        Tests 3529 passed (3529)
   Test Files 24 passed (24)
        Tests 229 passed (229)
   Test Files 13 passed (13)
        Tests 292 passed (292)
   502 passed (8.4m)
   Todo en verde.
   ```
3. **Pruebas en navegador con `playwright-cli` (headed y persistent, skill `web-qa`):**
   - Sesión abierta con `playwright-cli -s=nexora open http://localhost:3000/compras/facturas --headed --persistent`.
   - Inicio de sesión anunciado con `admin@nexora.com`.
   - Apertura del modal "Nueva factura" e inclusión de línea directa mediante "+ Gasto/Concepto" (`add-expense-line-button`).
   - Captura guardada en: `docs/revision/h9/capturas/fase6-servicios-gastos.png`.
   - Sesión cerrada con `playwright-cli -s=nexora close`.

### Lo que no salió como decía el plan
Ninguno.

---

## Fase 7: Nota de crédito a proveedor (`NCP`)

### Qué se construyó
- **Dominio (`apps/api/src/contexts/payables/domain`):**
  - Entidad `SupplierCreditNote` (`credit-note/supplier-credit-note.entity.ts`), VO `SupplierCreditNoteId`, tipos `CreditNoteReason`, `CreditNoteStatus` y primitivas de líneas y documento.
  - Soporte de cálculo de impuestos y subtotales en diezmilésimas con redondeo `roundRatio`.
  - Servicio de dominio `PayableCreditQuota` (`credit-note/credit-quota.service.ts`) para cómputo dinámico de crédito disponible (`available`) y verificación de cupo de facturas (`ensureWithinQuota`).
  - Puertos de repositorio y posting: `SupplierCreditNoteRepository` y `SupplierCreditNotePosting`.
- **Casos de uso de aplicación (`apps/api/src/contexts/payables/application`):**
  - `SupplierCreditNoteCreator`, `SupplierCreditNoteUpdater`, `SupplierCreditNoteConfirmer`, `SupplierCreditNoteCanceller`, `SupplierCreditNoteSearcher` y `SupplierAvailableCreditsFinder`.
  - Mecánica de emisión automática de pago (`SupplierPayment` método `credit_note`, referencia a nota de crédito) al confirmar nota vinculada a factura con saldo.
  - Bloqueo de anulación directa de pagos de emisión en `PaymentCanceller` (`IssuePaymentCannotBeCancelledDirectlyError`).
- **Persistencia e infraestructura HTTP (`apps/api`):**
  - `PrismaSupplierCreditNoteRepository` y `PrismaSupplierCreditNotePosting` con soporte completo PostgreSQL, transacciones atómicas y serialización segura.
  - Implementación en memoria `InMemoryPayablesStore` con serialización asíncrona para pruebas de contrato.
  - 7 controladores HTTP NestJS para notas de crédito bajo `/api/v1/payables/credit-notes` y cupos disponibles en `/api/v1/payables/suppliers/:supplierId/available-credits`.
  - 5 permisos `payables.creditnotes.*` sincronizados en catálogo y base de datos (121 permisos en total).
- **Frontend Web (`apps/web`):**
  - Tipos y cliente HTTP en `HttpPayablesApi`, server actions `saveCreditNote`, `changeCreditNote` y `getSupplierAvailableCredits` en `cuentas-por-pagar/actions.ts`.
  - Tablero interactivo `CreditNotesBoard` (`apps/web/src/sections/payables/credit-notes-board.tsx`) con tabla de notas, filtros por texto, proveedor, estado y fechas, opciones contextuales (editar, confirmar, anular) y slideover para crear/editar notas de crédito con líneas.
  - Página `/cuentas-por-pagar/notas-de-credito/page.tsx` integrada con control de roles y permisos.
- **Aislamiento Multitenant (`apps/e2e`):**
  - Matriz de aislamiento `isolation-matrix.ts` ampliada con los 7 endpoints de notas de crédito de proveedor.

### Reglas de H9 cubiertas
- **H9 §3.10:** Nota de crédito a proveedor (`NCP`).
- Confirmación genera automáticamente pago amortizador hasta saldo vivo (`issuePaymentId`). Remanente queda como cupo disponible no persistido.
- Anulación de nota revierte el pago de emisión y restaura el saldo de la factura; anulación bloqueada si tiene pagos externos aplicados.
- Bloqueada la anulación directa de pagos de emisión desde Pagos.
- Devolución citada: valida pertenencia al proveedor y no duplicación.

### Pruebas que lo defienden
- `src/contexts/payables/application/payables-credit-note.spec.ts` (11 pruebas unitarias).
- `src/contexts/payables/infrastructure/testing/in-memory-payables-ports.contract.spec.ts` (10 pruebas de contrato en memoria).
- `src/contexts/payables/infrastructure/persistence/prisma-payables-ports.contract.integration.spec.ts` (10 pruebas de contrato PostgreSQL).
- `src/contexts/access/infrastructure/http/route-declaration.spec.ts` (157 pruebas de rutas y permisos).
- `tests/isolation/isolation-coverage.spec.ts` y `tests/isolation/tenant-isolation.api.spec.ts` (16 pruebas de aislamiento multitenant de NCP).

### Mutaciones probadas (H9 §7)
1. **Fila §3.10 (Bloqueo de anulación directa de pagos de emisión generados por nota de crédito):**
   - *Qué se alteró:* En `apps/api/src/contexts/payables/application/cancel-payment/payment-canceller.ts`, se desactivó la comprobación de `issueNote` comentando la validación de `findByIssuePayment`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/payables/application/payables-credit-note.spec.ts`
   - *Líneas del fallo:*
     ```
     FAIL  src/contexts/payables/application/payables-credit-note.spec.ts > Supplier Credit Notes (NCP) in Payables > impide anular directamente desde Pagos un pago emitido automaticamente por una nota de credito activa
     AssertionError: promise resolved "undefined" instead of rejecting

     - Expected:
     Error {
       "message": "rejected promise",
     }

     + Received:
     undefined

      ❯ src/contexts/payables/application/payables-credit-note.spec.ts:379:6
         377|     await expect(
         378|       s.cancelPayment.run({ tenantId: TENANT_A, paymentId: issuePaymen…
         379|     ).rejects.toThrow(IssuePaymentCannotBeCancelledDirectlyError);
            |      ^
         380|   });
     ```

### Cómo se verificó
1. **Corridas intermedias corregidas:**
   - En `payables-rows.ts`, conversión explícita de `priceDifference` y `exchangeDifference` de Decimal a number para evitar fallos de clonación profunda (`DataCloneError`).
   - En `prisma-supplier-credit-note-posting.ts`, pase de instancia de `PayablesDate` en lugar de string en `paymentDetails.date`.
   - Normalización de motivos a enum `CreditNoteReason` ('damaged_goods', 'subsequent_discount', 'price_correction').
   - Inclusión de los 7 casos de notas de crédito en `apps/e2e/support/isolation-matrix.ts` para satisfacer el test arquitectónico `isolation-coverage.spec.ts`.
2. **Corrida final verde (`make verify` en `docs/revision/h9/logs/verify-fase7-1.log`):**
   ```
   516 passed (9.1m)
   Todo en verde.
   ```
3. **Pruebas en navegador con `playwright-cli` (headed y persistent, skill `web-qa`):**
   - Sesión abierta con `playwright-cli -s=fase7 open http://localhost:3000/login --headed --persistent`.
   - Inicio de sesión anunciado con `ana@acme.com`.
   - Navegación a `/cuentas-por-pagar/notas-de-credito` y captura de pantalla guardada en: `docs/revision/h9/capturas/fase7-notas-credito.png`.
   - Apertura del panel de creación de nota de crédito y captura en: `docs/revision/h9/capturas/fase7-nueva-nota-panel.png`.
   - Sesión cerrada con `playwright-cli -s=fase7 close`.

### Lo que no salió como decía el plan
Ninguno.

---

