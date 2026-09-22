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
*(En progreso)*

