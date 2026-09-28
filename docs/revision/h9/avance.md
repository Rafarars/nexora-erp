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

