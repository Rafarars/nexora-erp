# H6 — Cuentas por cobrar: informe de las fases 0 a 6

Alcance propuesto tras el H5 y **aprobado por Rafael tal cual**; hecho con la misma dinámica, sin
commitear hasta que lo pida. Las decisiones tomadas sin preguntar están en
`docs/PENDIENTE-REVISION.md`, archivo local fuera de Git.

**Alcance**: cobros con aplicación parcial a varias facturas, saldo y estado de cada factura,
vencidas, límite de crédito del cliente con bloqueo al facturar a crédito, antigüedad de saldos y
estado de cuenta. Fuera: anticipos y pagos de más, notas de crédito, intereses de mora, multimoneda,
aviso de crédito en el pedido.

Documentación funcional: [`modulos/cuentas-por-cobrar.md`](modulos/cuentas-por-cobrar.md).

---

## Fase 0 — Modelo y migración

**Migración:** `20260915000000_create_receivables_context`.

- `customers.credit_limit DECIMAL(18,2) NULL` con `CHECK >= 0`: nulo es sin límite.
- `customer_payments` (`COB`, fecha, método, referencia, notas, importe `CHECK > 0`, estado) y
  `payment_allocations` (`CHECK amount > 0`, `UNIQUE (payment_id, invoice_id)`, clave ajena compuesta
  a la factura con `RESTRICT`).
- **El saldo no es columna.** No hay `paid_amount` en `invoices`: sería cuentas por cobrar escribiendo
  una tabla de ventas, y un dato que se puede desincronizar de sus cobros. La regla «no más que el
  saldo» la guarda el bloqueo de las facturas (fase 3), probada con concurrencia real.

Durante la fase, el reemplazo que añadía la columna tomó el primer `paymentTermDays` del esquema,
que es el del **proveedor**, y el `migrate diff` mostró `ALTER TABLE "suppliers"`. Se corrigió antes
de generar la migración.

---

## Fase 1 — Dominio

**En ventas:**

| Pieza | Qué es |
|---|---|
| `customer.entity.ts` | `creditLimit` nulo o cero o más, con céntimos (`InvalidCreditLimitError`) |
| `invoice/credit/customer-credit.ts` | **La regla central**: con plazo > 0, vencidas → rechazo; deuda + total > límite → rechazo. Suma en céntimos enteros |
| `invoice.entity.ts` | `issue` recibe el crédito del cliente leído bajo bloqueo (plazo incluido); `cancel(now, paid)` rechaza con cobros |
| `invoice/posting/invoice-posting.ts` | `credit` (lectura previa) e `issue(…, today, work)` que entrega el crédito bloqueado |

**En cuentas por cobrar (contexto nuevo):**

| Pieza | Qué es |
|---|---|
| `ledger/receivable-invoice.ts` | La factura vista desde la cobranza: saldo, estado, días vencida y `ensureAccepts` (emitida, mismo cliente, fecha, saldo) |
| `ledger/receivables-ledger.ts` | Puerto para leer clientes y facturas de ventas con lo cobrado |
| `payment/customer-payment.entity.ts` | Cobro y su ciclo; el importe es la suma de lo aplicado |
| `payment/posting/payment-posting.ts` | Confirmar y anular con cobro y facturas bloqueados |
| `aging/aging.ts` | Tramos y totales en céntimos |

17 errores propios; los mensajes públicos sin identificadores ni números, como exige la prueba de
categorías.

**Contrato publicado nuevo:** `shared/prisma/receivable-balances.ts` (`RECEIVABLE_BALANCES`) con
`lockCustomer`, `exposure` y `paidOf`. Lo implementa cuentas por cobrar porque los cobros son suyos;
lo usa ventas dentro de su transacción.

---

## Fase 2 — Aplicación

8 casos de uso: crear, editar, confirmar y anular cobros; listar cobros, facturas por cobrar,
antigüedad y estado de cuenta. Crear y editar comprueban contra los saldos del momento antes de
gastar un correlativo; editar **conserva el identificador de lo aplicado a cada factura** (lección del
H4). El estado de cuenta calcula el saldo corrido en céntimos.

`InvoiceIssuer` ya no lee el cliente por su cuenta: el plazo y el límite vienen del crédito leído con
el cliente bloqueado, así una factura no usa un plazo viejo si alguien lo cambió en medio.

---

## Fase 3 — Infraestructura

| Publicación | Orden de bloqueo | Qué lee bajo bloqueo |
|---|---|---|
| `PrismaInvoicePosting.issue` (ventas) | despacho → pedido → **cliente** | Si ya tiene factura; deuda y vencidas por SQL; plazo y límite |
| `PrismaInvoicePosting.cancel` (ventas) | factura | Lo cobrado (`paidOf`) |
| `PrismaPaymentPosting` (cobranza) | cobro → **facturas por id** | Lo cobrado por los demás cobros confirmados |

**Por qué no hay interbloqueo:** emitir bloquea el cliente y ninguna factura ajena; confirmar un
cobro bloquea facturas y ningún cliente; anular una factura bloquea solo esa factura. Ningún camino
toma dos recursos en orden inverso a otro.

**Composición entre módulos sin ciclo:** `ReceivablesModule` **no importa** ventas (lee sus tablas por
su adaptador, como el inventario lee las del catálogo) y exporta `RECEIVABLE_BALANCES`;
`SalesModule` lo importa. El arnés de PostgreSQL de ventas compone `PrismaReceivableBalances`.

**Contratos:**
- `receivables-ports.contract.ts`, 9 casos contra doble y PostgreSQL: borrador que se reescribe,
  confirmado que no se pisa, lo cobrado solo cuenta confirmado, el trabajo que falla no escribe,
  **dos cobros de 70 sobre una factura de 100**, factura anulada en medio, lecturas por empresa.
- `sales-ports.contract.ts`, +3: **dos facturas a crédito de 9,28 con límite 15**, vencida que bloquea
  y cobrarla desbloquea, factura con cobros que no se anula.

---

## Fase 4 — API

8 rutas bajo `/api/v1/receivables`, 7 permisos en `RECEIVABLES_PERMISSIONS` (**75 en total**), 6
ataques nuevos en la matriz de aislamiento y la fotografía de Globex con cobros, saldos y antigüedad.

El filtro `GET /invoices?customerId=` con un cliente ajeno responde **404** y no una lista vacía: la
vigilancia de cobertura detectó el `customerId` en el DTO de consulta y la matriz exige 404, igual
que la disponibilidad con una bodega ajena.

---

## Fase 5 — Frontend

Pantallas `/cuentas-por-cobrar/{cobros,facturas,antiguedad,estado-de-cuenta}` y enlace en la barra
lateral. El formulario de cobro muestra, al elegir el cliente, sus facturas con saldo ordenadas por
vencimiento, con lo que deben y si están vencidas. El estado de cuenta es un formulario GET: el
cliente queda en la dirección. Clientes gana el límite de crédito; `readableSalesError` traduce los
tres errores nuevos de ventas y `readableReceivablesError` encadena con ventas.

---

## Fase 6 — Semillas y pruebas end-to-end

- **Semillas** (`seedReceivables`): Delta con límite 1000 y un cobro de 30 (debe 39,60); en Globex un
  cobro confirmado y uno en borrador para la matriz; el rol Consulta ve cuentas por cobrar.
- **API** (`tests/api/receivables.api.spec.ts`, 8): **las tres pruebas del plan** — anular un cobro
  revierte el saldo, un cliente con vencidas no factura a crédito (y cobrar lo desbloquea), el
  estado de cuenta cuadra con los saldos —, más cobro de más, cobros simultáneos, factura con cobros,
  contado sin control y límite con dos facturas simultáneas.
- **Interfaz** (`tests/ui/receivables.spec.ts`, 4): cobrar 40 de 100 y anularlo en pasos
  Dado/Cuando/Entonces pasando por facturas, antigüedad y estado de cuenta; el error de sobrecobro en
  español; «Facturar» desde Despachos rechazado por vencidas; solo lectura.

---

## Revisión rigurosa

| Hallazgo | Cómo apareció | Arreglo |
|---|---|---|
| **El plazo del cliente se leía fuera del bloqueo** al emitir: si alguien cambiaba el plazo entre la lectura y la emisión, la factura usaba el viejo | Revisión al meter el crédito en la emisión | Plazo, límite y deuda se leen juntos con el cliente bloqueado |
| La columna de límite cayó en `suppliers` | `prisma migrate diff` antes de escribir la migración | Movida a `customers` |
| El filtro por cliente ajeno devolvía lista vacía (200) | Diseño contra la matriz de aislamiento | 404 como el resto |
| Constante del límite máximo perdía precisión en coma flotante | `oxlint` (`no-loss-of-precision`) | Comparación en `BigInt` |
| El arnés creaba el cobro simulado con `tenantId` dentro de una creación anidada que Prisma no acepta | Contrato de ventas contra PostgreSQL | Cobro y aplicación en dos sentencias |
| Una expectativa de antigüedad estaba mal calculada en la prueba (40 días es tramo 31–60) | Prueba de aplicación | Corregida la prueba, no el código |

Lo que se decidió sin preguntar está en `docs/PENDIENTE-REVISION.md`.

---

## Validación

`make verify` completo en verde:

| Suite | Resultado |
|---|---|
| API unitarias | 2020 |
| Web unitarias | 136 |
| Contrato contra PostgreSQL | 120 |
| End-to-end | 279 |
