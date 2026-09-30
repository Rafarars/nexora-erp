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

### Ajuste 4 del usuario (Devoluciones de OTRAS entradas) - Resuelto
- **Escenario resuelto (Defecto 1.1):**
  - Entrada 1 (origen a revaluar): 10 unidades a 100 (Total = 1.000). Monto a revaluar: +100 (factura a 110).
  - Entrada 2 (otra entrada): 10 unidades a 150 (Total = 1.500). Existencia = 20, promedio = 125.
  - Devolución a proveedor de 5 unidades de la Entrada 2: en el kardex sale a su costo congelado de entrada (150).
  - **Resolución:** En `PriceVariance`, **ninguna devolución a proveedor** (`origin.type === 'purchase_return'`) cuenta como salida en el reparto proporcional (salen a costo congelado de entrada, no al promedio ponderado).
  - **Resultado actual:** `stockPart = 100`, `soldPart = 0`. La discrepancia teórica queda resuelta y defendida por la prueba unitaria `Ajuste 4 resuelto: purchase return of ANOTHER receipt does not count as exit in variance allocation`.

### Mutaciones probadas (H9 §7)
1. **Fila §3.3 (Devolución de la misma entrada no cuenta como salida):**
   - *Qué se quitó:* Condición `if (mov.origin.type === 'purchase_return') continue;` en `PriceVariance`.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/inventory/domain/stock/price-variance.spec.ts`
   - *Línea del fallo:* `src/contexts/inventory/domain/stock/price-variance.spec.ts:190:27`
     `AssertionError: expected 70 to be 100 // Object.is equality`
2. **Fila §3.3 (Factura en USD al mismo precio pero distinta tasa):**
   - *Qué se alteró:* Cálculo de `exchangeDiffBase` forzado a `0` en `PurchasePriceDifference`.
   - *Prueba corrida:* `pnpm --filter api test src/contexts/purchasing/domain/invoice/purchase-price-difference.spec.ts`
   - *Línea del fallo:* `src/contexts/purchasing/domain/invoice/purchase-price-difference.spec.ts:20:36`
     `AssertionError: expected +0 to be 500 // Object.is equality`
3. **Fila §3.3 (+40 con ventas entre factura y aprobación, 10 a 100, factura 110, se venden 6):**
   - *Qué se alteró:* En `apps/api/src/contexts/inventory/domain/stock/price-variance.ts`, se forzó `ratio = 1` omitiendo la multiplicación por `qtyAfter / qtyBefore`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/inventory/domain/stock/price-variance.spec.ts -t "calculates correctly when units sold between invoice and approval"`
   - *Línea del fallo:* `src/contexts/inventory/domain/stock/price-variance.spec.ts:111:27`
     `AssertionError: expected 100 to be 40 // Object.is equality`
4. **Fila §3.3 (+25 con dos entradas antes de facturar, 10 a 100, 10 a 150, se venden 15, factura primer lote 110):**
   - *Qué se alteró:* En `apps/api/src/contexts/inventory/domain/stock/price-variance.ts`, se forzó `ratio = 1`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/inventory/domain/stock/price-variance.spec.ts -t "handles two entries before invoicing"`
   - *Línea del fallo:* `src/contexts/inventory/domain/stock/price-variance.spec.ts:171:27`
     `AssertionError: expected 100 to be 25 // Object.is equality`
5. **Fila §3.3 (Todo vendido al aprobar manda todo a resultado y no escribe kardex):**
   - *Qué se alteró:* En `apps/api/src/contexts/inventory/domain/stock/price-variance.ts`, se forzó `ratio = 1`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/inventory/domain/stock/price-variance.spec.ts -t "allocates 100% to sold/cogs if stock was completely exhausted"`
   - *Línea del fallo:* `src/contexts/inventory/domain/stock/price-variance.spec.ts:72:27`
     `AssertionError: expected 100 to be +0 // Object.is equality`
6. **Fila §3.3 (Factura más barata que la entrada, parte en bodega y parte vendida):**
   - *Qué se alteró:* En `apps/api/src/contexts/inventory/domain/stock/price-variance.ts`, se forzó `ratio = 1`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/inventory/domain/stock/price-variance.spec.ts -t "handles negative price variance"`
   - *Línea del fallo:* `src/contexts/inventory/domain/stock/price-variance.spec.ts:91:27`
     `AssertionError: expected -200 to be -100 // Object.is equality`
7. **Fila §3.3 (Entra mercancía entre factura y aprobación no reduce ratio original):**
   - *Qué se alteró:* En `apps/api/src/contexts/inventory/domain/stock/price-variance.ts`, se incluyeron las entradas `direction === 'in'` en la dilución acumulada del factor.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/inventory/domain/stock/price-variance.spec.ts -t "incoming stock after sale does not reduce original ratio"`
   - *Línea del fallo:* `src/contexts/inventory/domain/stock/price-variance.spec.ts:139:27`
     `AssertionError: expected 28.5714 to be 40 // Object.is equality`
8. **Fila §3.3 (Una factura que cita entradas de dos bodegas genera dos revaluaciones):**
   - *Qué se alteró:* En `apps/api/src/contexts/inventory/infrastructure/persistence/prisma-invoice-revaluation-posting.ts`, se limitó el bucle de revaluaciones a `revaluations.slice(0, 1)`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/inventory/infrastructure/persistence/prisma-invoice-revaluation-posting.spec.ts -t "crea dos ajustes de revaluacion independientes"`
   - *Línea del fallo:* `src/contexts/inventory/infrastructure/persistence/prisma-invoice-revaluation-posting.spec.ts:231:32`
     `AssertionError: expected [ { …(13) } ] to have a length of 2 but got 1`
9. **Fila §3.3 (La revaluación manual por costo nuevo sigue funcionando igual):**
   - *Qué se alteró:* En `apps/api/src/contexts/inventory/domain/adjustment/posting/adjustment-confirmation.ts`, se omitió la salida de existencias al costo anterior en `revaluationEntries`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/inventory/domain/adjustment/posting/adjustment-posting.spec.ts -t "takes everything out at the old cost and brings it back at the new one"`
   - *Línea del fallo:* `src/contexts/inventory/domain/adjustment/posting/adjustment-posting.spec.ts:177:33`
     `AssertionError: expected 80 to be 40 // Object.is equality`
10. **Fila §4.1 (Anular factura con revaluación confirmada genera ajuste contrario en borrador):**
    - *Qué se alteró:* En `apps/api/src/contexts/inventory/infrastructure/persistence/prisma-invoice-revaluation-posting.ts`, se quitó `* -1` en `invertedAmount` al generar el reverso de la revaluación confirmada.
    - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/inventory/infrastructure/persistence/prisma-invoice-revaluation-posting.spec.ts -t "al anular una factura con revaluacion confirmada"`
    - *Línea del fallo:* `src/contexts/inventory/infrastructure/persistence/prisma-invoice-revaluation-posting.spec.ts:160:36`
      `AssertionError: expected 50 to be -50 // Object.is equality`

### Cómo se verificó
1. **Corridas intermedias rojas:**
   - Fallo en contrato PostgreSQL (`test-contract`):
     `AssertionError: expected 730 to be 20` debido a que `rec.exchange_rate` en la BD registraba la tasa contra VES (36.5) y requería aplicar `effectiveRateToBase` respecto a la moneda de la empresa (`baseCurrency`). Corregido calculando `effectiveRateToBase`.
   - Fallo en build de contenedores (`make up`):
     Ruta de import de `TenantId` en `invoice-revaluation-posting.ts`, decorador metadata `import type` en `prisma-purchase-invoice-posting.ts` y missing import de `ThreeWayMatcher` en `purchasing.module.ts`. Corregidos y verificados con `pnpm --filter api build` y `pnpm --filter web build`.
   - Fallo en typecheck (`make verify`):
     Propiedad privada `priceDifference` en `PurchaseInvoice`. Corregido añadiendo getters públicos `get priceDifference()` y `get exchangeDifference()`.
2. **Corrida final verde (`make verify` en `scratch/logs/verify-fase3-2.log`):**
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
2. **Corrida final verde (`make verify` en `scratch/logs/verify-fase4-1.log`):**
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

2. **Fila §3.8 (El saldo que dicen el listado, la antigüedad, el estado de cuenta y el tablero es el mismo):**
   - *Qué se alteró:* En `apps/api/src/contexts/payables/domain/ledger/payable-invoice.ts`, se omitió la resta de lo pagado en `balanceUnits()` dejando `return this.row.status === 'cancelled' ? 0n : amountUnits(this.row.total);`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/payables/application/payables-balances.spec.ts -t "el saldo que dicen el listado"`
   - *Línea del fallo:* `src/contexts/payables/application/payables-balances.spec.ts:309:34`
     ```
     FAIL src/contexts/payables/application/payables-balances.spec.ts > payables balances and statements > SupplierStatementSearcher > §3.8: el saldo que dicen el listado, la antigüedad, el estado de cuenta y el tablero es el mismo
     AssertionError: expected 300 to be 260 // Object.is equality

     - Expected
     + Received

     - 260
     + 300

      ❯ src/contexts/payables/application/payables-balances.spec.ts:309:34
         307|
         308|       // Coincidencia exacta de las 4 fuentes para el proveedor (60 + 200 = 260)
         309|       expect(invoiceListBalance).toBe(260);
            |                                  ^
         310|       expect(supplierAgingBalance).toBe(260);
         311|       expect(statementBalance).toBe(260);
     ```

### Cómo se verificó
1. **Corridas intermedias corregidas:**
   - La suite `route-declaration.spec.ts` detectó 5 permisos no mapeados de `creditnotes` agregados anticipadamente; se ajustó el catálogo para mantener estrictamente los permisos que cuentan con controladores activos en la fase actual.
   - En la corrida intermedia (`verify-fase5-1.log`) figuraban 3534 pruebas unitarias. Al retirar del catálogo los 5 permisos de notas de crédito que aún no tenían controlador activo (para cumplir la regla arquitectónica de que cada permiso declarado debe tener un endpoint), dejaron de ejecutarse las 10 pruebas parametrizadas asociadas (2 por permiso: una en `permissions.spec.ts` y una en `route-declaration.spec.ts`).
2. **Corrida final verde (`make verify` en `scratch/logs/verify-fase5-2.log`):**
   ```
    Test Files  179 passed (179)
         Tests  3524 passed (3524)
    Test Files  24 passed (24)
         Tests  229 passed (229)
    Test Files  13 passed (13)
         Tests  292 passed (292)
     502 passed (8.5m)
   Todo en verde.
   ```
   (El total refleja 179 archivos al incorporar `payables-balances.spec.ts` y 3524 pruebas tras la caída de las 10 pruebas de los permisos retirados).
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
2. **Corrida final verde (`make verify` en `scratch/logs/verify-fase6-1.log`):**
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
2. **Fila §3.10 (Una nota de crédito con pagos externos confirmados aplicados no se anula):**
   - *Qué se alteró:* En `apps/api/src/contexts/payables/infrastructure/testing/in-memory-payables-store.ts`, se desactivó la validación `if (false as boolean && hasExternal)` omitiendo el lanzamiento de `CreditNoteWithApplicationsError`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/payables/application/payables-credit-note.spec.ts -t "impide anular una nota de credito si ya tiene pagos externos confirmados aplicados"`
   - *Línea del fallo:* `src/contexts/payables/application/payables-credit-note.spec.ts:363:6`
     ```
     FAIL src/contexts/payables/application/payables-credit-note.spec.ts > Supplier Credit Notes (NCP) in Payables > impide anular una nota de credito si ya tiene pagos externos confirmados aplicados
     AssertionError: promise resolved "undefined" instead of rejecting
      ❯ src/contexts/payables/application/payables-credit-note.spec.ts:363:6
         361| await expect(
         362|   s.cancelCreditNote.run({ tenantId: TENANT_A, creditNoteId: noteCreated.id }),
         363| ).rejects.toThrow(CreditNoteWithApplicationsError);
            |  ^
     ```
3. **Fila §3.10 (NCP por más de lo que debe abona hasta el saldo, resto se gasta en Pagos, gastar de más se rechaza):**
   - *Qué se alteró:* En `apps/api/src/contexts/payables/infrastructure/testing/in-memory-payables-store.ts`, se desactivó la validación `if (primitives.amount > remaining)` omitiendo el lanzamiento de `CreditNoteExceededError`.
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/payables/application/payables-credit-note.spec.ts -t "permite aplicar el credito disponible de una nota en un pago posterior a proveedor"`
   - *Línea del fallo:* `src/contexts/payables/application/payables-credit-note.spec.ts:265:6`
     ```
     FAIL src/contexts/payables/application/payables-credit-note.spec.ts > Supplier Credit Notes (NCP) in Payables > permite aplicar el credito disponible de una nota en un pago posterior a proveedor
     AssertionError: promise resolved "undefined" instead of rejecting
      ❯ src/contexts/payables/application/payables-credit-note.spec.ts:265:6
         263| await expect(
         264|   s.confirmPayment.run({ tenantId: TENANT_A, paymentId: overPayment.id }),
         265| ).rejects.toThrow(CreditNoteExceededError);
            |  ^
     ```
4. **Fila §3.10 (Una NCP de rebaja sobre mercancía en bodega baja su costo por revaluación; una que acredita una devolución no revalúa):**
   - *Qué se alteró:* En `apps/api/src/contexts/payables/infrastructure/testing/in-memory-payables-store.ts`, se forzó `totalPriceDifference = 0` (el defecto 1.5 original).
   - *Prueba corrida:* `pnpm --filter api exec vitest run src/contexts/payables/application/payables-credit-note.spec.ts -t "exige invoiceLineId en rebaja de mercancia"`
   - *Línea del fallo:* `src/contexts/payables/application/payables-credit-note.spec.ts:446:34`
     ```
     FAIL src/contexts/payables/application/payables-credit-note.spec.ts > Supplier Credit Notes (NCP) in Payables > exige invoiceLineId en rebaja de mercancia y valida correspondencia y monto maximo (1.5, §2)
     AssertionError: expected +0 to be -20 // Object.is equality

     - Expected
     + Received

     - -20
     + 0

      ❯ src/contexts/payables/application/payables-credit-note.spec.ts:446:34
         444| const note = await s.searchCreditNotes.findById({ tenantId: TENANT_A, creditNoteId: valid.id });
         445| expect(note.status).toBe('confirmed');
         446| expect(note.priceDifference).toBe(-20);
            |                              ^
     ```

### Cómo se verificó
1. **Corridas intermedias corregidas:**
   - En `payables-rows.ts`, conversión explícita de `priceDifference` y `exchangeDifference` de Decimal a number para evitar fallos de clonación profunda (`DataCloneError`).
   - En `prisma-supplier-credit-note-posting.ts`, pase de instancia de `PayablesDate` en lugar de string en `paymentDetails.date`.
   - Normalización de motivos a enum `CreditNoteReason` ('damaged_goods', 'subsequent_discount', 'price_correction').
   - Corrida roja de cobertura de aislamiento en `tests/isolation/isolation-coverage.spec.ts`:
     ```
     1) [isolation] › tests/isolation/isolation-coverage.spec.ts:56:1 › every route that takes an identifier has an isolation case 

       Error: expect(received).toEqual(expected) // deep equality

       - Expected  - 1
       + Received  + 3

       - Array []
       + Array [
       +   "POST /api/v1/payables/credit-notes",
       + ]

         60 |   );
         61 |
       > 62 |   expect(missing).toEqual([]);
            |                   ^
         63 | });
           at /home/medine01/dev/erp-portafolio/apps/e2e/tests/isolation/isolation-coverage.spec.ts:62:19
     ```
     Corregido registrando los 7 endpoints de notas de crédito de proveedor en `apps/e2e/support/isolation-matrix.ts`.
2. **Corrida final verde (`make verify` en `scratch/logs/verify-fase7-1.log`):**
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
- **Defecto 1.5 y corrección del plan (§2):** La `NCP` de rebaja de precio (`price_correction`) inicialmente confirmaba con `priceDifference = 0` y no generaba la revaluación de inventario porque las líneas del modelo de notas de crédito no guardaban a qué línea de factura hacían referencia. Se corrigió el plan incorporando el campo opcional `SupplierCreditNoteLine.invoiceLineId` (obligatorio en rebaja de mercancía), las validaciones de que la línea pertenezca a la factura y no supere el importe facturado, y la emisión de revaluaciones de inventario por importe negativas en borrador (una por bodega).

---

## Fase 8 — Semillas completas y suite extremo a extremo (E2E)

### Qué se construyó y qué cubre
1. **Semillas completas de Cuentas por Pagar (`apps/api/prisma/seed.ts`):**
   - Implementación de los casos canónicos del Ajuste 7 con identificadores deterministas en `PAYABLES`:
     - **Caso 1 (`FCP000001`):** Factura de compra con mercancía a mayor precio que su orden/entrada, generando revaluación positiva en borrador `AJU000003` en bodega `main`.
     - **Caso 2 (`FCP000002`):** Factura de compra con mercancía a mayor precio que su entrada, con revaluación confirmada `AJU000004` (kardex y stock actualizado en bodega `north`).
     - **Caso 3 (`FCP000003`):** Factura que referencia dos recepciones en distintas bodegas (`main` y `north`), con dos revaluaciones en borrador `AJU000005` y `AJU000006`.
     - **Caso 4 (`FCP000004`):** Factura de servicio bajo orden `OC000004` y gasto operativo sin orden previa.
     - **Caso 5 (`FCP000005`):** Factura con mercancía al mismo costo pactado que su recepción (sin revaluación).
     - **Caso 6 (`PAG000001`):** Pago parcial por transferencia que abona a dos facturas distintas (`FCP000001` por 65 USD y `FCP000004` por 15 USD).
     - **Caso 7 (`NCP000001` y `PAG000002`):** Nota de crédito de corrección de precio sobre `FCP000001` que genera revaluación negativa en borrador `AJU000007` y pago de emisión `PAG000002` que amortiza el saldo vivo (4,60 USD), dejando crédito disponible para el proveedor.
     - **Caso 8 (`NCP000002` y `PAG000003`):** Nota de crédito que acredita la devolución `DVC000001` amortizando 6,96 USD en `FCP000005`.
     - **Aislamiento multi-empresa:** Entidades espejo de facturas, notas de crédito y pagos para Globex con sus propios identificadores deterministas.
2. **Page Object de Cuentas por Pagar (`apps/e2e/pages/payables.page.ts`):**
   - Abstracción de navegación entre secciones (`facturas`, `pagos`, `antiguedad`, `estado-de-cuenta`, `notas-de-credito`), manejo de filtros y búsqueda con paginación, formularios de registro de pago con imputaciones y aplicación de notas de crédito, acciones de menú de fila y consulta de estados de cuenta.
3. **Fixtures de prueba (`apps/e2e/support/purchasing-fixtures.ts`):**
   - Agregada función helper `aConfirmedPurchaseInvoice` para crear y confirmar facturas de compra aisladas en las pruebas E2E.
4. **Suite Extremo a Extremo (`apps/e2e/tests/ui/payables.spec.ts`):**
   - 4 pruebas E2E ejecutadas sobre la UI completa con Playwright:
     - Pago parcial de factura por pantalla y reversión íntegra de saldo al anular el pago.
     - Pago en bolívares de una factura en dólares con cálculo visible del diferencial cambiario.
     - Uso y gasto del saldo a favor de una nota de crédito como forma de pago para otra factura desde la interfaz.
     - Control de permisos para rol de sólo lectura (`ACCOUNTANT` / `Carla Mena`): visualización de pagos, facturas, antigüedad y notas de crédito sin acciones mutantes.
5. **Correcciones aplicadas durante la integración:**
   - **Permiso en roles de semilla:** Eliminado el permiso inexistente `reports.payables.search` de `ACME_VIEWER_ROLE` en `apps/api/prisma/seed.ts`.
   - **Renderizado de notas de crédito en frontend:** En `apps/web/src/sections/payables/credit-notes-board.tsx` y `apps/web/src/modules/payables/domain/payables.ts`, la API entrega la moneda como un objeto `{ code, symbol, exchangeRate }`. Se tipó correctamente la interfaz y se corrigió el renderizado a `{note.currency.code}` junto a la exhibición del crédito disponible `{note.availableCredit}`, previniendo el error boundary de React.
   - **Resolución de nota de crédito origen en pagos:** En `apps/api/src/contexts/payables/application/search-payments/payment-searcher.ts`, se inyectó `SupplierCreditNoteRepository` y se resolvieron `creditSourceCode`, `isIssuePayment` e `issueCreditNoteCode` a partir de `creditSourceId` e `issuePaymentId`, siguiendo el patrón existente en `receivables`.

### Pruebas añadidas
- `apps/e2e/tests/ui/payables.spec.ts:9:1`:
  `test('pays part of a purchase invoice from the screen and cancelling the payment gives the balance back')`
- `apps/e2e/tests/ui/payables.spec.ts:60:1`:
  `test('pays a dollar purchase invoice in bolivars from the screen and shows the exchange difference')`
- `apps/e2e/tests/ui/payables.spec.ts:85:1`:
  `test('spends available credit from a credit note in a payment from the screen')`
- `apps/e2e/tests/ui/payables.spec.ts:171:1`:
  `test('a read-only role sees payments, balances and aging but gets no way to pay')`

### Capturas con `playwright-cli` (headed y persistent, skill `web-qa`)
- Sesión abierta con: `playwright-cli -s=fase8 open http://localhost:3000 --headed --persistent`.
- Inicio de sesión anunciado con `ana@acme.com`.
- Capturas generadas y archivadas:
  1. `docs/revision/h9/capturas/fase8-facturas.png` (Listado de facturas por pagar y saldos vivos).
  2. `docs/revision/h9/capturas/fase8-pagos.png` (Listado de pagos a proveedores, estados y diferenciales cambiarios).
  3. `docs/revision/h9/capturas/fase8-notas-credito.png` (Tablero de notas de crédito de proveedor con importes y créditos disponibles).
  4. `docs/revision/h9/capturas/fase8-antiguedad.png` (Reporte de antigüedad de deuda por proveedor por tramos).
- Sesión cerrada con: `playwright-cli -s=fase8 close`.

### Cómo se verificó
1. **Corridas rojas investigadas y corregidas:**
   - **Corrida roja en `make seed`:** Violación de clave foránea al insertar `'reports.payables.search'` en `role_permissions` porque dicho código no existía en el catálogo de permisos. Corregido manteniendo únicamente los permisos válidos del catálogo.
   - **Corrida roja 1 en `payables.spec.ts`:**
     - Test 3 falló con `CreditNoteInvoiceTotalExceededError` al intentar emitir una nota de crédito por un importe superior al total de la factura vinculada. Corregido abonando previamente a la factura para reducir su saldo vivo antes de emitir la nota de crédito, generando legítimamente el sobrante de crédito disponible sin violar el tope total de la factura.
     - Test 4 falló con `This page couldn't load` al abrir notas de crédito para rol de sólo lectura debido a que `credit-notes-board.tsx` intentaba renderizar `{note.currency}` como hijo directo de React siendo un objeto. Corregido tipando el objeto de moneda y mostrando `note.currency.code`.
   - **Corrida roja 2 en `payables.spec.ts`:**
     - Test 3 falló esperando `payment-credit-source` porque `PaymentSearcher` en el backend devolvía `creditSourceCode: null` hardcodeado. Corregido inyectando `SupplierCreditNoteRepository` y mapeando los códigos correspondientes tanto para notas de origen como de emisión.
2. **Corrida verde de la suite E2E:**
   ```
   $ playwright test payables.spec.ts
   Running 4 tests using 2 workers
     ✓ 1 pays part of a purchase invoice from the screen and cancelling the payment gives the balance back
     ✓ 2 pays a dollar purchase invoice in bolivars from the screen and shows the exchange difference
     ✓ 3 spends available credit from a credit note in a payment from the screen
     ✓ 4 a read-only role sees payments, balances and aging but gets no way to pay
   4 passed (1.0m)
   ```
3. **Corrida final verde del sistema completo (`make verify` en `scratch/logs/verify-fase8.log`):**
   ```
   520 passed (21.6m)
   Todo en verde.
   ```

---

## Correcciones post-revisión (Ronda 2)

### Fase 1: Arquitectura, puertos e inyección estricta
- **Puerto de revaluación independiente de contexto:**
  - Extraído `INVOICE_REVALUATION_POSTING` a `apps/api/src/shared/prisma/invoice-revaluation-posting.ts` con tipos desacoplados de `purchasing`, eliminando el antiguo archivo acoplado en `purchasing/domain/invoice/invoice-revaluation-posting.ts`.
  - El token Symbol `INVOICE_REVALUATION_POSTING` y sus interfaces de datos son ahora consumidos de forma simétrica por `inventory`, `purchasing` y `payables`.
- **Cálculo de diferencia de precio y tasa base compartido:**
  - Creado `apps/api/src/shared/domain/purchase-price-difference.ts` unificando `calculatePurchasePriceDifference` y `effectiveRateToBase`.
  - Eliminadas las 3 copias duplicadas de `effectiveRateToBase` en `prisma-purchase-invoice-posting.ts`, `in-memory-purchase-invoice-posting.ts` y `prisma-supplier-credit-note-posting.ts`.
  - Prueba unitaria compartida en `apps/api/src/shared/domain/purchase-price-difference.spec.ts`.
- **Hacer obligatorias las dependencias críticas (sin `@Optional()`):**
  - En `PrismaPurchaseInvoicePosting`: `INVOICE_REVALUATION_POSTING` y `BUSINESS_CALENDAR` son inyectados obligatoriamente sin `@Optional()`.
  - En `PrismaSupplierCreditNotePosting`: `INVOICE_REVALUATION_POSTING` y `BUSINESS_CALENDAR` son obligatorios sin `@Optional()`. Se eliminó el fallback de fecha con `toISOString().slice(0, 10)` al anular notas de crédito, usando siempre `await this.businessCalendar.today(tenant)`.
  - En `PrismaReportingReadModel`: `PAYABLE_BALANCES` es obligatorio sin `@Optional()`.
- **Manejo de errores en revaluación por inventario:**
  - Creado `RevaluationSourceMovementNotFoundError` en `inventory.errors.ts` y registrado en `error-categories.spec.ts`.
  - En `PrismaStockLedger.recordPriceVariance()`: si no existe el movimiento de origen en kardex, lanza `RevaluationSourceMovementNotFoundError` en lugar de omitir la línea silenciosamente con `continue`.
  - En `PrismaSupplierCreditNotePosting`: si no se encuentra el movimiento de kardex origen (`receiptLineId`) al registrar revaluación de nota de crédito, se lanza `RevaluationSourceMovementNotFoundError`.
- **Comentario de módulo:**
  - En `reporting.module.ts`: actualizado el comentario para indicar que importa `PayablesModule` y `CompanyModule`.
- **Verificación y corrección de arneses de prueba:**
  - **Corrida roja 1 (`make verify` en `scratch/logs/verify-correcciones-fase1.log`):**
    El paso de typecheck falló con `error TS2554` y `error TS2345` debido a constructores de arneses (`PrismaPayablesPortsHarness`, `PrismaPurchasingPortsHarness`, `PrismaReportingReadModelHarness`) que instanciaban clases con dependencias obligatorias sin proveerlas, y un import huérfano en `purchasing-ports.harness.ts`.
  - **Corrección aplicada:**
    - `PrismaPayablesPortsHarness`: inyectados `revaluationPosting` y `calendar`.
    - `PrismaPurchasingPortsHarness`: inyectado `calendar`.
    - `PrismaReportingReadModelHarness`: inyectado `payableBalances` con `FixedDocumentRates`, `ClockBusinessCalendar` y `PrismaPayablesLedger`.
    - `in-memory-invoice-revaluation-posting.ts`: tipado con `TenantLike` y tipos explícitos en acumuladores reduce.
  - **Corrida verde final (`make verify` en `scratch/logs/verify-correcciones-fase1-r2.log`):**
    ```
    520 passed (12.8m)
    Todo en verde.
    ```
### Fase 2: Reglas de negocio de la NCP y revaluación completa
- **Validación de línea y artículo en nota de crédito (§1.1, §1.3):**
  - En la entidad `SupplierCreditNote`: si la nota cita factura y no devolución, el campo `invoiceLineId` es obligatorio en cada línea (lanza `CreditNoteLineInvoiceLineRequiredError`).
  - Creado el error de dominio `CreditNoteLineItemMismatchError` en `payables.errors.ts` y registrado en `error-categories.spec.ts`.
  - En `SupplierCreditNoteCreator` y `SupplierCreditNoteUpdater`: si la línea de nota no incluye `itemId`, se autocompleta con el artículo de la línea de factura citada. Si incluye `itemId`, valida coincidencia con la línea de factura (`CreditNoteLineItemMismatchError`).
  - Validación de tope acumulado por línea: la suma de notas confirmadas sobre esa línea de factura más el importe de la línea actual no puede superar el subtotal de la línea de factura (`CreditNoteLineAmountExceedsInvoiceError`).
- **Bloqueo transaccional y revaluación al confirmar NCP (§1.2, §3.10, Defecto 1.5):**
  - En `PrismaSupplierCreditNotePosting.confirm`:
    - Adquiere bloqueo `FOR UPDATE` sobre la factura citada antes de evaluar topes de línea y cupo global, serializando confirmaciones concurrentes.
    - Evalúa el tope acumulado por línea mediante `creditedAmountByInvoiceLines` bajo el bloqueo antes de evaluar el cupo global de la factura.
    - Genera ajustes de revaluación por importe negativa en borrador (`createDraftRevaluations`) usando la tasa de recepción de la mercancía (`amountBase = -1 * subtotal * receiptRate`) y guardando la diferencia en cambio (`lineExchangeDiff = -1 * subtotal * (noteRate - receiptRate)`).
    - `confirm` propaga `userId` a `createDraftRevaluations` y actualiza `priceDifference` y `exchangeDifference` en la nota de crédito.
- **Anulación de nota de crédito con reversión de revaluación (§4.1):**
  - En `PrismaSupplierCreditNotePosting.cancel` y `InMemoryPayablesStore.cancel`:
    - Si el ajuste de revaluación asociado está en borrador, lo descarta/cancela.
    - Si el ajuste de revaluación ya estaba confirmado, genera un nuevo ajuste de revaluación inverso en borrador (`amount = -amount`) con dirección `in` hacia el movimiento de kardex de entrada original.
    - Se propaga `userId` al caso de uso, repositorio y servicio de revaluaciones.
- **Arneses y pruebas de contrato:**
  - `PayablesPortsHarness` extiende la interfaz con `invoiceLines`, `adjustmentsOf`, `approveAdjustment` y `ensureItem`.
  - `PrismaPayablesPortsHarness` e `InMemoryPayablesPortsHarness` implementan los nuevos métodos del arnés garantizando paridad entre el doble en memoria y PostgreSQL.
  - 16/16 pruebas de contrato en verde en PostgreSQL (`prisma-payables-ports.contract.integration.spec.ts`).
  - 16/16 pruebas de contrato en verde en memoria (`in-memory-payables-ports.contract.spec.ts`).
- **Demostración de pruebas mediante mutaciones de código en PostgreSQL:**
  - **Mutación §3.10:** Comentar la llamada a `createDraftRevaluations` en `PrismaSupplierCreditNotePosting.confirm`.
    - Fallo obtenido en PostgreSQL:
      `src/contexts/payables/testing/payables-ports.contract.ts:433:31: expect(adjs.length).toBe(1) -> Expected: 1, Received: 0`.
  - **Mutación §4.1:** Comentar la llamada a `cancelOrReverseRevaluations` en `PrismaSupplierCreditNotePosting.cancel`.
    - Fallos obtenidos en PostgreSQL:
      1. `src/contexts/payables/testing/payables-ports.contract.ts:487:34: expect(adjs[0].status).toBe('cancelled') -> Expected: "cancelled", Received: "draft"`.
      2. `src/contexts/payables/testing/payables-ports.contract.ts:537:38: expect(updatedAdjs.length).toBe(2) -> Expected: 2, Received: 1`.
- **Verificación del sistema completo (`make verify` en `scratch/logs/verify-correcciones-fase2-r3.log`):**
  - **Corrida roja 1 (`verify-correcciones-fase2.log`):**
    Typecheck detectó discordancias de tipos en `payables-credit-note.spec.ts` (`invoiceId`), firmas de constructores de error (`CreditNoteLineItemMismatchError`, `CreditNoteLineAmountExceedsInvoiceError`) y nulabilidad de `originType`/`originId` en `PrismaPayablesPortsHarness.adjustmentsOf`. Corregidos todos.
  - **Corrida roja 2 (`verify-correcciones-fase2-r2.log`):**
    Fallo en `apps/e2e/tests/ui/payables.spec.ts:130` porque la creación de NCP en el test citaba factura pero no pasaba `invoiceLineId`, disparando la nueva regla de dominio §1.1. Se adaptó `aConfirmedPurchaseInvoice` en `purchasing-fixtures.ts` para consultar las líneas de la factura confirmada por GET y pasar `invoiceLineId: invoice1.lines[0]?.id` en el test.
  - **Corrida verde final (`verify-correcciones-fase2-r3.log`):**
    ```
### Fase 3: Selector de líneas de factura en NCP y origen en ajustes (Prompt §1.1 y Ajuste 4)
- **Resolución de código de origen en ajustes vía `MOVEMENT_DOCUMENTS` (Ajuste 4):**
  - `apps/api/src/contexts/inventory/domain/documents/movement-documents.ts`: ampliado `DocumentOriginType` con `'purchase_invoice' | 'supplier_credit_note'`.
  - `apps/api/src/contexts/inventory/infrastructure/persistence/prisma-movement-documents.ts`: implementada la resolución de códigos para compras (`purchaseInvoice`) y notas de crédito de proveedor (`supplierCreditNote`).
  - `apps/api/src/contexts/inventory/infrastructure/testing/in-memory-movement-documents.ts`: añadido método `seed(tenantId, id, code)` para pruebas de aplicación.
  - `apps/api/src/contexts/inventory/application/search-adjustments/adjustment-searcher.ts`: inyectado `MovementDocuments` como dependencia opcional; eliminada la regex sobre `notes` (`/\b(FCP[A-Z0-9_-]+)\b/i`) y resuelto `originCode` formalmente mediante `codesOf`.
  - `apps/api/src/contexts/inventory/infrastructure/inventory.module.ts`: inyectado `MOVEMENT_DOCUMENTS` en el proveedor de `AdjustmentSearcher`.
  - `apps/api/src/contexts/inventory/application/adjustment-lifecycle.spec.ts`: prueba unitaria `resolves originCode for purchase invoices and supplier credit notes via MOVEMENT_DOCUMENTS (H9 Correcciones 2 Ajuste 4)`.
  - **Demostración de prueba mediante mutación de código:**
    En `adjustment-searcher.ts:146`, mutando `originCode: null`:
    Salida roja obtenida:
    ```
    FAIL src/contexts/inventory/application/adjustment-lifecycle.spec.ts > queries > resolves originCode for purchase invoices and supplier credit notes via MOVEMENT_DOCUMENTS (H9 Correcciones 2 Ajuste 4)
    AssertionError: expected null to be 'FCP000042'
     ❯ src/contexts/inventory/application/adjustment-lifecycle.spec.ts:431:41
    ```
    Restaurado y verificado en verde (24/24 pruebas pasadas).

- **Selector de líneas de factura en la interfaz web (§1.1):**
  - `apps/web/src/sections/payables/credit-notes-board.tsx`:
    - En `CreditNoteFields`: soporte dinámico de facturas afectadas (`selectedInvoiceId`). Al seleccionar una factura, consulta sus líneas mediante `getPurchaseInvoice`.
    - Selector de línea de factura por cada fila (`lineInvoiceLineId`, testId `credit-note-line-invoice-line-${index}`).
    - Autocompletado automático de concepto, precio unitario de la factura, cantidad sugerida y tasa de impuesto al seleccionar la línea de la factura.
    - Envío de campos ocultos `lineItemId`, `lineItemSku`, `lineItemName` y `lineUnitId`.
  - `apps/web/src/app/(app)/cuentas-por-pagar/actions.ts`:
    - En `saveCreditNote`: captura de `lineInvoiceLineId` e información del ítem, pasándolos al cliente HTTP.
    - Server action `getPurchaseInvoice`: consulta la factura mediante `purchasingApi().findInvoice(token, invoiceId)`.
  - `apps/web/src/modules/purchasing/infrastructure/http-purchasing-api.ts`:
    - En `findInvoice`: desenvuelve `{ invoice: ... }` retornado por el endpoint REST de la API.
  - `apps/web/src/modules/payables/domain/payables-api.ts` y `payables.ts`:
    - Tipos `CreditNoteLineInput` y `SupplierCreditNoteLine` ampliados con `invoiceLineId?: string | null`.

- **Pruebas E2E y sesión con `playwright-cli` visible (skill `web-qa`):**
  - `apps/e2e/support/purchasing-fixtures.ts`: añadido helper `aConfirmedMerchandiseInvoice` que encadena orden de compra inventariable, recepción en bodega confirmada y factura de mercancía confirmada con `receiptLineId`.
  - `apps/e2e/tests/ui/payables.spec.ts`: test E2E `creates a supplier credit note selecting invoice line and shows origin NCP in inventory adjustments (H9 Correcciones 2 Ajuste 4)`. Verifica la creación de la NCP desde la UI seleccionando la línea de factura, su confirmación, y comprueba en Inventario -> Ajustes que el ajuste de revaluación generado en borrador expone `(NCP...)` en sus líneas.
  - Ejecución con `playwright-cli -s=fase3` en modo `--headed` y `--persistent` con grabación de traza, vídeo y capturas en `docs/revision/h9/evidencia/fase3/`:
    - `01-notas-de-credito-listado.png`: listado de notas de crédito con estados y totales.
    - `02-nota-credito-selector-linea-factura.png`: formulario de nueva nota de crédito con la factura y la línea de factura seleccionadas y autocompletadas.
    - `03-inventario-ajustes-origen-ncp.png`: tabla de ajustes de inventario mostrando el ajuste `AJU000007` con `Revaluación -10,00 (NCP000001) AGUA-500`.
    - `recorrido.webm`: grabación en vídeo de la sesión.

- **Verificación completa de la Fase 3 (`make verify`):**
  - **Corrida roja 1 (`scratch/logs/verify-fase3-run.log`):**
    En `test-unit`, la prueba de timing contra ataque de canal lateral en contraseñas falló por jitter de CPU bajo alta concurrencia de vitest en la API:
    ```
    FAIL src/contexts/access/infrastructure/security/argon2-password-hasher.spec.ts > Argon2PasswordHasher > takes as long to reject a missing account as a real one
    AssertionError: expected 37.12982000000011 to be greater than 41.649126000000024
     ❯ src/contexts/access/infrastructure/security/argon2-password-hasher.spec.ts:58:28
    ```
    Al aislar la prueba, pasa consistentemente en verde (870ms).
  - **Corrida roja 2 (`scratch/logs/verify-fase3-run-2.log`):**
    En `test-contract`, la suite `prisma-company-ports.contract.integration.spec.ts` falló en su `reset()`:
    ```
    Invalid `this.prisma.warehouse.deleteMany()` invocation in
    src/contexts/company/infrastructure/testing/prisma-company-ports.harness.ts:57:33
    Foreign key constraint violated on the constraint: sales_orders_tenant_id_warehouse_id_fkey
    ```
    *Causa identificada:* La suite `prisma-sales-returns-of-invoice.integration.spec.ts` (añadida para §3.6) creaba órdenes de venta en `TENANT_A` asociadas a la bodega principal pero no llamaba a `harness.reset()` en su gancho `afterAll()`, dejando órdenes de venta activas que bloqueaban la eliminación de bodegas en suites posteriores.
    *Corrección aplicada:* En `prisma-sales-returns-of-invoice.integration.spec.ts:33-37`, se añadió la llamada a `await harness.reset()` dentro de `afterAll()`.
  - **Corrida verde final (`scratch/logs/verify-fase3-run-3.log`):**
    - `apps/api lint`: 41 avisos (imports no utilizados de errores), 0 errores en 1148 archivos.
    - `apps/web lint`: 0 avisos y 0 errores en 44 archivos.
    - `apps/e2e lint`: 0 avisos y 0 errores en 30 archivos.
    - `test-unit`: 183 suites pasadas (183), 3649 pruebas pasadas (3649) en API; 229 pruebas pasadas (229) en Web.
    - `test-contract`: 13 suites pasadas (13), 300 pruebas pasadas (300) en PostgreSQL.
    - `test-e2e`: 521 pruebas pasadas (521) en Playwright (9.4m).

### Fase 4: Integridad de semilla y pagos con remanente de NCP (Prompt §2 y Ajuste 5)
- **Comprobación de integridad automática de la semilla (`verifySeedIntegrity`):**
  - Implementada directamente en `apps/api/prisma/seed.ts` e invocada al final de `main()`. Se ejecuta en cada `make seed` o `make verify`:
    1. Recorre todas las líneas de entrada de mercancía (`goodsReceiptLine`) y verifica que la suma facturada por facturas confirmadas no supere la cantidad recibida físicamente (`invoiced <= received`), y que tras descontar devoluciones acreditadas por notas de crédito, la facturación neta no exceda lo recibido neto (`invoiced - credited <= received - returned`).
    2. Recorre las facturas de compra confirmadas con líneas de recepción y verifica que el campo `priceDifference` almacenado coincida exactamente con el cálculo oficial de `calculatePurchasePriceDifference` (ubicado en `src/shared/domain/purchase-price-difference.ts`).
- **Demostración de fallo antes de la corrección:**
  - Al ejecutar `seed.ts` con la función de comprobación sobre la semilla previa a las correcciones, falló de inmediato con la salida exacta:
    ```
    Error: Seed integrity violation: receipt line ec000000-0000-4000-8000-000000000001 (AGUA-500) has received=4, returned=0, quota=4, but confirmed invoices total=6
        at verifySeedIntegrity (/home/medine01/dev/erp-portafolio/apps/api/prisma/seed.ts:2564:13)
        at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
        at async main (/home/medine01/dev/erp-portafolio/apps/api/prisma/seed.ts:353:5)
        at async <anonymous> (/home/medine01/dev/erp-portafolio/apps/api/prisma/seed.ts:2629:1)
    ```
- **Correcciones aplicadas a la semilla:**
  - **Entradas propias con cupo para `FCP000003`:**
    - Creada orden `OC000006` en bodega `main` por 2 cajas de agua mineral y recepción `ENT000004` (2 cajas a 12.0 USD).
    - Creada orden `OC000007` en bodega `north` por 3 kg de detergente y recepción `ENT000005` (3 kg a 3.0 USD).
    - Generados movimientos de kardex y existencias independientes para ambas recepciones.
    - `FCP000003` vinculada a `interWarehouseWaterReceiptLine` (2 cajas a 14.0 USD, diferencia +4.0 USD) e `interWarehouseNorthReceiptLine` (3 kg a 4.5 USD, diferencia +4.5 USD).
    - Corregido `priceDifference: 8.5` en `FCP000003` (4.0 + 4.5 = 8.5 USD en vez del erróneo 6.5 USD).
    - Corregido `AJU000006` en bodega `north` con `amount: 4.5` (en vez de 2.5) apuntando a `interWarehouseNorthMovement`.
    - `AJU000005` en bodega `main` con `amount: 4.0` apuntando a `interWarehouseWaterMovement`.
  - **Cupos consistentes en órdenes y recepciones:**
    - En `partialWater` (`OC000001`): fijado explícitamente `invoicedQuantity: 4` (recibido 4, facturado 4 por `FCP000001`).
    - En `northOrderLine` (`OC000005`): fijado `invoicedQuantity: 10` (recibido 10, facturado 10 por `FCP000002`).
  - **Consumo de crédito remanente de `NCP000001` (Ajuste 7):**
    - `NCP000001` (total 11.60 USD) amortizaba 4.60 USD en `FCP000001` vía `PAG000002`, dejando 7.00 USD disponibles.
    - Creado pago `PAG000004` con método `credit_note`, `creditSourceId: NCP000001`, aplicando los 7.00 USD a `FCP000002` con su diferencial cambiario de 15.05 VES (tasa 152.40 vs 150.25).
    - El crédito disponible de `NCP000001` queda en 0.00 USD.
  - **Correlativos:**
    - `code_sequences` actualizados: `OC: 7`, `ENT: 5`, `PAG: 4`.
- **Verificación completa de la Fase 4 (`make verify` en `scratch/logs/verify-fase4-run.log`):**
  - `apps/api lint`: 41 avisos, 0 errores en 1148 archivos.
  - `apps/web lint`: 0 avisos y 0 errores en 44 archivos.
  - `apps/e2e lint`: 0 avisos y 0 errores en 30 archivos.
  - `test-unit`: 183 suites pasadas (183), 3649 pruebas pasadas (3649) en API; 229 pruebas pasadas (229) en Web.
  - `test-contract`: 13 suites pasadas (13), 300 pruebas pasadas (300) en PostgreSQL.
  - `seed`: ejecutado y validado en caliente por `verifySeedIntegrity` sin errores.
  - `test-e2e`: 521 pruebas pasadas (521) en Playwright (8.9m).


