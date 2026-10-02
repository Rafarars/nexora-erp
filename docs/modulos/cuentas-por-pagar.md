# Cuentas por pagar

**Qué se le debe** a cada proveedor, desde cuándo, **qué se le pagó** y **cuánto crédito queda** a favor.

Contexto: `apps/api/src/contexts/payables` · Pantallas: `/cuentas-por-pagar/*` · Informe técnico:
[`../H9-COMPRAS-HASTA-EL-PAGO.md`](../H9-COMPRAS-HASTA-EL-PAGO.md)

| Submódulo | Tabla | Prefijo | Qué es |
|---|---|---|---|
| Facturas por pagar | `purchase_invoices` (lectura) | `FCP` | Deudas comerciales nacidas en Compras al confirmar una factura |
| Pagos a proveedores | `supplier_payments`, `supplier_payment_allocations` | `PAG` | Desembolsos monetarios o aplicaciones de crédito que amortizan facturas |
| Notas de crédito | `supplier_credit_notes`, `supplier_credit_note_lines` | `NCP` | Rebajas de precio de proveedor o acreditaciones de devoluciones |
| Saldos y exposición | — (`PAYABLE_BALANCES`) | — | Saldo vivo consolidado por proveedor y factura |
| Antigüedad de saldos | — (Reporting / Payables) | — | Deuda distribuida en tramos de vencimiento |
| Estado de cuenta | — (Reporting / Payables) | — | Cronología de cargos y abonos con saldo corrido |

---

## Principios

1. **El saldo se calcula en un solo sitio: el puerto `PAYABLE_BALANCES`.**
   No existe ninguna segunda resta SQL en consultas o reportes. Toda pantalla, listado, antigüedad, estado de cuenta y tarjeta de tablero lee la exposición mediante este puerto:
   ```ts
   export const PAYABLE_BALANCES = Symbol('PayableBalances');
   export interface PayableBalances {
     ofSupplier(tenantId: TenantId, supplierId: SupplierId): Promise<SupplierExposure>;
     ofInvoice(tenantId: TenantId, invoiceId: PurchaseInvoiceId): Promise<Money>;
   }
   ```
2. **Un borrador no toca ningún saldo.** Solo los documentos en estado `confirmed` alteran el saldo deudor o el crédito disponible.
3. **Pagar de más se rechaza.** Una asignación de pago que supere el saldo vivo de la factura lanza `PaymentExceedsBalanceError`. Pagar facturas de otro proveedor se rechaza.
4. **La NCP abona automáticamente hasta el saldo de la factura.**
   Si el total de la nota supera lo que la factura debe, amortiza la factura a 0 y el remanente queda como crédito disponible (`availableCredit`) a favor de la empresa, gastable desde Pagos en otras facturas del mismo proveedor.
5. **Rebaja de precio vs Devolución física.**
   - Una `NCP` por rebaja de precio (`reason === 'discount'`) requiere `invoiceLineId` en cada línea de mercancía y engendra un ajuste de revaluación en borrador en Inventario para ajustar el costo promedio.
   - Una `NCP` que acredita una devolución (`reason === 'return'`) se vincula a una `DVC` física y **no revalúa** inventario, porque la devolución física ya extrajo la mercancía al costo congelado.

---

## 1. Pagos a proveedores — `supplier_payments`

| Campo | Tipo | Regla |
|---|---|---|
| `code` | `PAG000001` | Asignado al crear |
| `supplier_id` | UUID | Obligatorio; proveedor al que se le paga |
| `payment_date` | fecha | Obligatoria |
| `payment_method` | enum | `transfer`, `cash`, `check`, `credit_note` |
| `reference` | texto(100) | Opcional (obligatoria en transferencia/cheque) |
| `amount` | decimal(18, 4) | Monto pagado en la moneda del pago |
| `currency` | código ISO | Moneda del pago (ej. USD, VES) |
| `exchange_rate` | decimal(18, 6) | Tasa de cambio respecto a la moneda de la empresa |
| `status` | enum | `draft`, `confirmed`, `cancelled` |

### Pagos de emisión de NCP
Cuando se confirma una `NCP` vinculada a una factura que tiene saldo pendiente, el sistema genera automáticamente un pago interno de emisión (`isIssuePayment = true`).
- **Protección antifraude:** El pago de emisión **no puede ser anulado directamente** desde la pantalla de Pagos (`IssuePaymentCannotBeCancelledDirectlyError`). Se anula exclusivamente al anular la `NCP` de origen.

---

## 2. Notas de crédito de proveedores — `supplier_credit_notes`

| Campo | Tipo | Regla |
|---|---|---|
| `code` | `NCP000001` | Asignado al crear |
| `supplier_id` | UUID | Proveedor emisor |
| `invoice_id` | UUID | Factura de compra a la que se imputa (opcional) |
| `purchase_return_id` | UUID | Devolución a proveedor vinculada (opcional) |
| `note_number` | texto(50) | Número legal de la nota del proveedor |
| `reason` | enum | `discount` (rebaja de precio), `return` (devolución física) |
| `status` | enum | `draft`, `confirmed`, `cancelled` |

### Líneas de nota de crédito (`supplier_credit_note_lines`)
- **`invoiceLineId`:** Identifica la línea de la factura que se rebaja. Permite rastrear la entrada original (`sourceMovementId`) y la bodega para la revaluación de inventario.
- **Tope acumulado por línea:** La suma de rebajas aplicadas a una línea de factura (entre la nota actual y notas confirmadas previas) no puede exceder el importe total facturado en esa línea (`CreditNoteLineAmountExceedsInvoiceError`).
- **Moneda de la rebaja:** La nota de crédito se emite en la misma moneda que la factura que rectifica.

### Selector de devoluciones elegibles
Endpoint: `GET /api/v1/purchasing/returns/eligible-for-credit-note?supplierId=...`
Lista las devoluciones a proveedor (`DVC`) confirmadas que aún no han sido acreditadas por una `NCP` activa, permitiendo vincularlas en un clic desde la pantalla de creación.

---

## 3. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio | `contexts/payables/domain/**/*.spec.ts` | Entidades `PayableInvoice`, `SupplierPayment`, `SupplierCreditNote`, cálculo exacto de amortización y crédito remanente |
| Aplicación | `payables-credit-note.spec.ts`, `supplier-payment.spec.ts` | Amortizaciones parciales, pagos bimoneda, límites de crédito, bloqueo de pagos de emisión, reversión de pagos |
| Contrato | `prisma-payables-ports.contract.integration.spec.ts` | Concurrencia de pagos (`FOR UPDATE`), integridad referencial, reconciliación del saldo en PostgreSQL |
| Balances | `payables-balances.spec.ts` | Conciliación idéntica entre listado, antigüedad, estado de cuenta y tablero |
| Destructivas | `tests/destructive/h9-mutations.spec.ts` | Bloqueo de anulación de notas con pagos aplicados y anulación de facturas con pagos |
