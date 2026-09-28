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

### Lo que quedó en FUTURE.md
Ninguno.

---

