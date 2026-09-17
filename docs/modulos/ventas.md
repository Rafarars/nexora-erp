# Ventas

**A quién** se le vende, **qué** pidió, **qué queda reservado**, **qué salió** de las bodegas y **qué
se facturó**.

Contexto: `apps/api/src/contexts/sales` · Pantallas: `/ventas/*` · Informe técnico:
[`../H5-VENTAS.md`](../H5-VENTAS.md)

| Submódulo | Tabla | Prefijo | Qué es |
|---|---|---|---|
| Clientes | `customers` | `CLI` | A quién se le vende, con su plazo de pago y su límite de crédito |
| Pedidos | `sales_orders`, `sales_order_lines` | `PED` | Lo que pide un cliente; confirmado, **reserva** existencia |
| Despachos | `dispatches`, `dispatch_lines` | `DES` | Lo que sale de un pedido; confirmado, **baja** la existencia |
| Facturas | `invoices`, `invoice_lines` | `FAC` | Lo que se cobra de un despacho; **no toca** la existencia |
| Disponibilidad | — (se calcula) | — | Existencia − reservado, por artículo y bodega |

**Depende de** Catálogo (artículos, unidades, impuestos, bodegas), que lee por su puerto, y de
**Inventario**, al que le pide bloquear existencias para reservar y sacarlas al despachar, por el
mismo contrato publicado que usa Compras. Y de **Cuentas por cobrar**, a la que le pregunta cuánto debe
el cliente al facturar a crédito y si una factura tiene cobros al anularla
([cuentas-por-cobrar.md](cuentas-por-cobrar.md)).

---

## Principios

1. **El pedido no mueve existencia: la reserva.** Solo el despacho confirmado la saca.
2. **No se reserva lo que no está disponible.** Disponible es lo que hay menos lo que ya reservaron
   los demás pedidos. Dos confirmaciones simultáneas del mismo artículo esperan en fila.
3. **Nunca sale más de lo vendido** (`CHECK dispatched_quantity <= quantity`, dominio y bloqueo).
4. **La factura cobra un despacho, una sola vez**, y guarda sus importes: un documento fiscal no
   cambia porque luego cambie un precio.
5. **Nada se borra.** Un cliente se desactiva; pedidos, despachos y facturas se anulan.

---

## 1. Clientes — `customers`

Mismos campos y reglas que un proveedor ([compras.md §1](compras.md#1-proveedores--suppliers)):
nombre único por empresa, identificación fiscal libre, correo, teléfono, dirección y
**plazo de pago de 0 a 365 días** (0 es contado). Uno inactivo no recibe pedidos nuevos.

**El plazo decide cuándo vence la factura**: se toma el plazo del cliente **al emitirla**.

**Límite de crédito**: monto de cero o más, o vacío para no tener límite. Decide cuánto se le puede
fiar; se explica con ejemplos en [cuentas-por-cobrar.md §3](cuentas-por-cobrar.md#3-límite-de-crédito-y-facturas-a-crédito).

---

## 2. Pedidos

### 2.1 Cabecera y líneas

| Campo | Regla |
|---|---|
| `customer_id` | Cliente de la empresa y **activo** |
| `warehouse_id` | Bodega de salida, de la empresa y **activa** |
| `order_date` | Por defecto hoy; **no futura** |
| Línea: `item_id`, `unit_id` | Artículo **activo e inventariado**; unidad **del artículo** |
| Línea: `quantity`, `base_quantity` | Mayor que cero; base con el factor de hoy al guardar. Si la caja cambia antes de confirmar, el pedido no se confirma hasta revisarlo y guardarlo (`SalesItemChangedError`) |
| Línea: `unit_price` | Cero o más, por unidad de la línea, **sin impuesto** |
| Línea: `tax_rate` | **Copiado del impuesto del artículo** |
| Línea: `dispatched_quantity` | Lo que sumaron los despachos confirmados |

Montos por línea redondeados a los **decimales de importe de la empresa** (`amount_decimals`), como en compras.

### 2.2 Ciclo de vida

```
 borrador ──confirmar (reserva)──▶ confirmado ──despacho──▶ despachado en parte ──despacho──▶ despachado
    │                                  │         ◀──anular despacho──          ◀──anular despacho──
    └────────────anular───────────▶ anulado ◀──anular── (solo si no se despachó nada)
```

| Estado | Qué reserva | Qué se puede hacer |
|---|---|---|
| **Borrador** | Nada | Editar, confirmar, anular |
| **Confirmado** | Todo lo pedido | Despachar, anular (libera la reserva) |
| **Despachado en parte** | Lo pendiente | Despachar el resto |
| **Despachado** | Nada | Nada (salvo anular un despacho) |
| **Anulado** | Nada | Nada |

### 2.3 La reserva

**No se guarda aparte.** Lo reservado es lo pendiente de despachar, en unidad base, de los pedidos
confirmados o despachados en parte. Así nunca se desincroniza de los pedidos.

**Al confirmar**, con el pedido bloqueado:

1. Se bloquean las filas de existencia de sus artículos en su bodega (contrato del inventario,
   `lockAvailable`). Si un artículo nunca tuvo existencia, se crea su fila en cero para bloquearla.
2. Se suma lo reservado por **los demás** pedidos confirmados de esa bodega.
3. Por cada artículo (varias líneas del mismo se suman): si lo que pide supera
   `existencia − reservado por otros`, se rechaza con `InsufficientAvailabilityError` y no se
   confirma nada.

Ejemplo: hay 300, otro pedido reservó 60. Un pedido de 10 cajas (240) cabe; uno de 241 no.

**Anular** libera la reserva: un pedido anulado deja de contar.

**Los artículos se bloquean antes que las existencias.** Al confirmar, con los artículos bloqueados en
modo compartido, se comprueba que sigan activos, inventariados y con el factor con que se calcularon
las cantidades base. Si cambiaron entre la revalidación y el bloqueo, el pedido no reserva
(`SalesItemChangedError`, 409) y se vuelve a intentar. Mientras el pedido esté abierto, el maestro
de artículos no deja desactivar el artículo ni cambiar la unidad que usa.

### 2.4 Moneda y tasas

El pedido lleva `currency`, `exchange_rate`, `base_currency`, `base_exchange_rate` y
`manual_exchange_rate` con las **mismas reglas que la orden de compra**
([compras.md §2.4](compras.md#24-moneda-y-tasas)): la moneda la elige quien captura (por defecto, la
de la empresa); el borrador refresca las tasas del día del pedido o la última anterior; confirmar las
congela; una tasa escrita a mano se conserva si la empresa lo permite. Sin tasa, no se guarda
(`MissingExchangeRateError`, 409).

**El límite de crédito se compara en la moneda de la empresa**: el total del pedido o de la factura
se pasa a ella con sus tasas antes de sumarlo a lo que el cliente debe.

---

## 3. Despachos

| Campo | Regla |
|---|---|
| `order_id`, `warehouse_id` | Del pedido, **confirmado o despachado en parte**. No cambian |
| `dispatch_date` | Por defecto hoy; **no futura** |
| Línea: `order_line_id` | Una línea **de su pedido**, una sola vez por despacho |
| Línea: `quantity` | Mayor que cero y **no más de lo pendiente** |
| Línea: `base_quantity` | **La proporción de la línea del pedido**, que es lo que el pedido reservó |

**No lleva costo ni moneda.** El inventario valora la salida al **costo promedio vigente**, y el
despacho no cobra nada: la moneda está en el pedido y la tasa, en la factura.

| Paso | En el pedido | En el inventario |
|---|---|---|
| Crear o editar borrador | Nada | Nada |
| **Confirmar** | Suma lo despachado (con el pedido bloqueado) y **libera esa parte de la reserva** | Sale la cantidad base al promedio; **se rechaza si ya no hay existencia** |
| Anular un borrador | Nada | Nada |
| **Anular un confirmado** | Resta lo despachado: **vuelve a reservarse** y el pedido retrocede | Devuelve la existencia con contrapartidas |

- **Un despacho facturado no se anula**: primero se anula su factura.
- **Si alguien sacó la existencia reservada** (un ajuste de salida por una merma o un conteo, por
  ejemplo; ver [inventario.md §2.0.1](inventario.md#201-un-ajuste-de-salida-y-las-reservas-de-ventas)), el despacho se
  rechaza con «La bodega ya no tiene la existencia de este despacho» y no cambia nada.

- **Anular un despacho de un artículo que se desactivó** se rechaza (`InactiveSalesItemError`):
  devolvería existencia a un artículo que ya no se ofrece. Primero se reactiva.

---

## 4. Facturas

Se emiten **desde un despacho confirmado**. No tienen borrador: nacen emitidas.

| Campo | Cómo se obtiene |
|---|---|
| `code` | `FAC000001` |
| `dispatch_id`, `order_id`, `customer_id` | Del despacho y su pedido |
| `issue_date` | Por defecto hoy; **no futura** |
| `due_date` | `issue_date + plazo del cliente` (contado: el mismo día) |
| Líneas | Una por línea del despacho: cantidad × **precio del pedido**, con su impuesto |
| `currency` | **La del pedido.** Aunque la moneda se haya retirado del catálogo después |
| `exchange_rate`, `base_exchange_rate` | **Del día de emisión** (o la última anterior), no las del pedido: la factura es el documento fiscal |
| `subtotal`, `tax`, `total` | **Guardados**, en su moneda, redondeados por línea a los decimales de la empresa |
| `subtotal_ves`, `tax_ves`, `total_ves` | Los mismos importes **en bolívares** a la tasa de emisión, como pide la ley venezolana |
| `status` | `issued` o `cancelled` |

**Reglas**

- **Una factura emitida por despacho.** Lo impide el bloqueo del despacho y, como última palabra,
  un índice único parcial en la base (`invoices_one_issued_per_dispatch`).
- **No mueve existencia.** Anularla tampoco.
- Anular una factura deja al despacho volver a facturarse o anularse.
- **A crédito** (cliente con plazo > 0) no se emite si el cliente tiene **facturas vencidas** o si
  **lo que debe + esta factura supera su límite**. La de contado no se frena. Con el cliente bloqueado
  ([cuentas-por-cobrar.md §3.2](cuentas-por-cobrar.md#32-la-regla-al-emitir)).
- **Una factura con cobros confirmados no se anula**: primero se anulan los cobros.

Ejemplo: 4 cajas a 30 con 16 % → subtotal 120,00, IVA 19,20, total 139,20. Con plazo de 15 días,
emitida el 15 de enero vence el 30.

Ejemplo de moneda: un pedido en euros confirmado el 10 de septiembre (171,30) se factura el 17
(175,05). La factura toma **175,05**: un total de 100 € vale 17 505,00 Bs.

---

## 5. Disponibilidad

`GET /api/v1/sales/availability?warehouseId=` devuelve, por artículo y bodega, **existencia,
reservado y disponible**, en unidad base. Es una foto para mirar: la reserva de verdad se decide al
confirmar, con las filas bloqueadas.

---

## 6. API y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Clientes | `GET/POST /api/v1/sales/customers`, `PUT …/:customerId`, `PUT …/:customerId/status` | `sales.customers.{search,create,update,deactivate}` |
| Pedidos | `GET/POST /api/v1/sales/orders`, `PUT …/:orderId` | `sales.orders.{search,create,update}` |
| Confirmar pedido | `PUT /api/v1/sales/orders/:orderId/confirm` | `sales.orders.confirm` |
| Anular pedido | `PUT /api/v1/sales/orders/:orderId/cancel` | `sales.orders.cancel` |
| Despachos | `GET/POST /api/v1/sales/dispatches`, `PUT …/:dispatchId` | `sales.dispatches.{search,create,update}` |
| Confirmar despacho | `PUT /api/v1/sales/dispatches/:dispatchId/confirm` | `sales.dispatches.confirm` |
| Anular despacho | `PUT /api/v1/sales/dispatches/:dispatchId/cancel` | `sales.dispatches.cancel` |
| Facturas | `GET /api/v1/sales/invoices` | `sales.invoices.search` |
| Emitir factura | `POST /api/v1/sales/invoices` `{ "dispatchId": "…" }` | `sales.invoices.issue` |
| Anular factura | `PUT /api/v1/sales/invoices/:invoiceId/cancel` | `sales.invoices.cancel` |
| Disponibilidad | `GET /api/v1/sales/availability` | `sales.availability.search` |

**Errores más frecuentes**

| Código | HTTP | Cuándo |
|---|---|---|
| `InsufficientAvailabilityError` | 409 | Confirmar un pedido que no cabe en lo disponible |
| `SalesItemChangedError` | 409 | Un artículo cambió mientras se confirmaba el pedido: se vuelve a intentar |
| `SalesOrderWithDispatchesError` | 409 | Anular un pedido con mercancía despachada |
| `DispatchExceedsPendingError` | 409 | El despacho supera lo pendiente |
| `InsufficientStockForDispatchError` | 409 | La bodega ya no tiene la existencia |
| `DispatchInvoicedError` | 409 | Anular un despacho facturado |
| `DispatchAlreadyInvoicedError` | 409 | Facturar dos veces un despacho |
| `DispatchNotInvoiceableError` | 409 | Facturar un despacho que no está confirmado |
| `CustomerWithOverdueInvoicesError` | 409 | Facturar a crédito a un cliente con vencidas |
| `CreditLimitExceededError` | 409 | La factura a crédito supera el límite |
| `InvoiceWithPaymentsError` | 409 | Anular una factura con cobros |

---

## 7. Pantallas

| Ruta | Qué muestra |
|---|---|
| `/ventas/pedidos` | Pedidos con cliente, líneas con lo despachado, total con IVA y estado. Menú: despachar, editar, confirmar, anular |
| `/ventas/despachos` | Despachos con su pedido y cliente, lo que salió, estado y factura. Menú: editar, confirmar, **facturar**, anular |
| `/ventas/facturas` | Facturas con cliente, despacho, líneas a su precio, total, **vencimiento** y estado. Menú: anular |
| `/ventas/disponibilidad` | Existencia, reservado y disponible por artículo y bodega |
| `/ventas/clientes` | Maestro con identificación fiscal, contacto, plazo y límite de crédito |

Los despachos se crean desde su pedido y las facturas desde su despacho: nunca se elige un documento
que no admite el paso siguiente.

---

## 8. Datos de demostración

| Empresa | Qué hay |
|---|---|
| Acme | **Comercial Delta** (`J-40123456-7`, 15 días, límite 1000) y **Bodegón La Esquina** (contado) |
| Acme | `PED000001` a Delta, **despachado en parte**: 5 cajas de agua a 30 (2 despachadas) y 10 kg de detergente a 5,50 |
| Acme | `DES000001` confirmado: 2 cajas = 48 un al promedio 0,50. El agua pasa de 336 a **288** |
| Acme | `FAC000001` emitida: 69,60, **vence el 22-09-2026**; Delta abonó 30 y debe 39,60 |
| Acme | `PED000002` a La Esquina, borrador |
| Acme | Disponibilidad en Principal: agua 288 − 72 reservadas = **216**; detergente 50 − 10 = **40** |
| Globex | Talleres Omega; pedido despachado en parte con despacho y factura, despacho en borrador y pedido en borrador: blancos de la matriz |

El rol **Consulta** ve clientes, pedidos, despachos, facturas y disponibilidad, pero no vende.

---

## 9. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio | `contexts/sales/domain/**/*.spec.ts` | Reserva (sumar líneas, reservado de otros, pendiente), ciclo del pedido, despacho proporcional, factura con vencimiento e importes, errores |
| Aplicación | `customer-lifecycle.spec.ts`, `sales-cycle.spec.ts` | Reservar y liberar, no reservar de más, despachar en partes, existencia que ya no está, facturar una vez, despacho facturado no se anula |
| Contrato | `sales-ports.contract.ts` | 12 casos contra doble y PostgreSQL con el inventario real: **dos pedidos simultáneos que no caben**, **dos despachos simultáneos**, **dos facturas simultáneas del mismo despacho** |
| Aplicación | `sales-currency.spec.ts` | Moneda del pedido, tasa manual, factura con la tasa de su emisión e importes en bolívares, crédito en la moneda de la empresa |
| API | `tests/api/sales.api.spec.ts` | Recorrido por HTTP, reserva, concurrencia, costo promedio en el kardex, vencimiento, permisos, **factura en euros con la tasa de emisión y tasa manual del pedido** |
| Interfaz | `tests/ui/sales.spec.ts` | **El ciclo completo** comprar → recibir → vender → despachar → facturar en pasos Dado/Cuando/Entonces; error de disponibilidad en español; solo lectura |
| Aislamiento | `tests/isolation/*` | 13 ataques a clientes, pedidos, despachos, facturas y disponibilidad de Globex |
