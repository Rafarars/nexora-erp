# H5 — Ventas: informe de las fases 0 a 6

Hecho de corrido, **sin revisión previa de Rafael** (lo pidió así por falta de tiempo) y sin
commitear hasta cerrar la verificación. Las decisiones tomadas sin preguntar están en
`docs/PENDIENTE-REVISION.md`, archivo local fuera de Git.

**Alcance**: clientes, pedido con reserva, despacho, factura y disponibilidad; el ciclo completo
comprar → recibir → vender → despachar → facturar probado de punta a punta. Fuera: límite de crédito
y cobros (H6), devoluciones, notas de crédito, listas de precio, vender servicios.

Documentación funcional: [`modulos/ventas.md`](modulos/ventas.md).

---

## Fase 0 — Modelo y migración

**Migración:** `20260914000000_create_sales_context` — `customers`, `sales_orders`,
`sales_order_lines`, `dispatches`, `dispatch_lines`, `invoices`, `invoice_lines`.

- `CHECK dispatched_quantity <= quantity`: nunca sale más de lo vendido.
- `CHECK due_date >= issue_date`.
- **Índice único parcial** `invoices_one_issued_per_dispatch` sobre `(tenant_id, dispatch_id)`
  donde `status = 'issued'`: un despacho se factura una vez, también bajo concurrencia.
- Las facturas **guardan sus importes** (`subtotal`, `tax`, `total` y los de cada línea).

Durante la fase, un reemplazo en el esquema duplicó relaciones en `MeasurementUnit` y la primera
migración falló al aplicarse. Se marcó como revertida con `prisma migrate resolve --rolled-back`
(no borra datos ni hace falta `reset`), se regeneró el SQL y se aplicó.

---

## Fase 1 — Dominio

**Base copiada de compras** (objetos de valor, cliente como el proveedor, puerto de catálogo) con
nombres y errores propios: ventas no importa compras.

| Pieza | Qué es |
|---|---|
| `order/sales-order.entity.ts` | Pedido y su ciclo; `reservedByItem()` da lo que reserva en unidad base |
| `order/posting/stock-reservation.ts` | **La regla central**: confirma solo si cada artículo cabe en `existencia − reservado por otros` |
| `order/posting/stock-availability.ts` | Lo que la reserva necesita ya bloqueado: existencia y reservado por otros |
| `dispatch/` | Despacho, fábrica de líneas (base proporcional a la línea del pedido), confirmación y anulación puras que devuelven `none` / `release` / `reverse` |
| `invoice/invoice.entity.ts` | Factura emitida desde un despacho: importes por línea, vencimiento con el plazo, anulación |

**Inventario ampliado**: el contrato publicado suma `release` (salida al promedio) y
`lockAvailable` (bloquear filas de existencia y devolver cuánto hay); el kardex admite origen
`dispatch` y `MovementDocuments` lee los códigos de despachos.

---

## Fase 2 — Aplicación

18 casos de uso: clientes (4), pedidos (5), despachos (5), facturas (emitir, anular, listar) y
disponibilidad. Confirmar pedidos y despachos **revalida el borrador conservando los
identificadores de sus líneas** (lección del H4). Emitir una factura valida antes de pedir el
correlativo y otra vez con el despacho bloqueado.

El doble en memoria lleva un **inventario de juguete** que imita la reserva, la salida y la
reversión, y rechaza sacar lo que no hay.

---

## Fase 3 — Infraestructura

| Publicación | Orden de bloqueo | Qué escribe |
|---|---|---|
| `PrismaSalesOrderPosting` | pedido → existencias (`lockAvailable`) → suma de reservas por SQL | Estado del pedido |
| `PrismaDispatchPosting` | despacho → pedido → existencias (`release` / `reverse`) | Despacho, pedido y kardex |
| `PrismaInvoicePosting` | despacho → pedido | Factura y líneas (índice parcial como respaldo) |

**Por qué la reserva no rompe con concurrencia.** Dos pedidos del mismo artículo bloquean la misma
fila de `item_stocks`; el segundo espera, y al continuar su consulta de reservas ve el pedido que el
primero ya confirmó (lectura confirmada por sentencia en PostgreSQL). Un artículo sin fila de
existencia la crea en cero para poder bloquearla.

**Contrato** (`sales-ports.contract.ts`, 12 casos, doble y PostgreSQL con el inventario real): dos
pedidos de 6 sobre 10, dos despachos de 6 sobre 10, dos facturas del mismo despacho a la vez,
despacho sin existencia que no escribe nada, anular con y sin factura.

---

## Fase 4 — API

18 rutas bajo `/api/v1/sales`, 18 permisos en `SALES_PERMISSIONS` (**68 en total**), 13 ataques
nuevos en la matriz de aislamiento, fotografía de Globex con ventas y la vigilancia de cobertura
reconociendo `customerId`, `dispatchId` e `invoiceId`.

---

## Fase 5 — Frontend

Pantallas `/ventas/{pedidos,despachos,facturas,disponibilidad,clientes}`. Los tableros se derivaron
de los de compras y se ajustaron: «Despachar» desde el pedido, «Facturar» desde el despacho,
vencimiento visible en facturas. El kardex muestra «Despacho» como origen. `readableSalesError`
encadena con los mensajes de compras, inventario, catálogo y acceso.

---

## Fase 6 — Semillas y pruebas end-to-end

- **Semillas** (`seedSales`): en Acme, pedido despachado en parte con despacho y factura (el agua
  baja de 336 a 288 con su movimiento), borrador y dos clientes; en Globex, los blancos de la matriz.
- **API** (`tests/api/sales.api.spec.ts`): reserva, sobre-reserva rechazada, pedidos simultáneos,
  despacho al costo promedio, factura con vencimiento, doble factura y despacho facturado, existencia
  sacada por un ajuste, permisos.
- **Interfaz** (`tests/ui/sales.spec.ts`): **el ciclo completo** en pasos Dado/Cuando/Entonces:
  comprar 10 cajas → recibir → 240 disponibles → vender 4 cajas → 96 reservadas y existencia intacta →
  despachar → 144 en existencias y kardex con compra y despacho → facturar → 139,20 con IVA y
  existencia intacta.

---

## Revisión rigurosa

| Hallazgo | Cómo apareció | Arreglo |
|---|---|---|
| **Carrera en la navegación de las pruebas de interfaz**: el módulo redirige a su primera sección, y si se elegía la sección antes de que terminara la redirección, esta llegaba después y dejaba la pantalla en la sección equivocada | Fallaron dos pruebas de interfaz: la de solo lectura de compras y el ciclo completo | Los cuatro page objects (catálogo, inventario, compras y ventas) esperan la URL del módulo y la de la sección. Catálogo e inventario tenían el mismo defecto latente |
| Restos de la copia desde compras en la web (`receipt`, `formatAmount` de otro módulo) | Verificación de tipos | Corregidos |
| La prueba de etiquetas de módulo usaba `sales` como ejemplo de módulo desconocido | Prueba unitaria de la web al nacer ventas | Usa `receivables` |
| Esquema con relaciones duplicadas y migración fallida | Validación y `make migrate` | Ver fase 0 |

Lo que se decidió sin preguntar está en `docs/PENDIENTE-REVISION.md`.

---

## Validación

`make verify` completo en verde:

| Suite | Resultado |
|---|---|
| API unitarias | 1861 |
| Web unitarias | 122 |
| Contrato contra PostgreSQL | 108 |
| End-to-end | 255 |
