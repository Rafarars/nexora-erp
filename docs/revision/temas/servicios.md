# Tema: servicios en los documentos

**Pregunta** (del [checklist](../README.md#temas-por-investigar-y-ubicar)): si se pueden comprar y vender
servicios cuando la factura nace del despacho, y qué hace una línea de servicio con el estado del documento.

**Fecha:** 18-sep-2026. **Estado:** decidido; en construcción.

---

## 1. Qué hace hoy el sistema

El artículo ya tiene el tipo `service` y el maestro lo admite, pero **ningún documento comercial lo acepta**:

| Dónde | Qué hace |
|---|---|
| `purchasing/domain/order/lines/purchase-order-references.ts:68` | `ServiceNotPurchasableError` al escribir la línea |
| `purchasing/domain/order/posting/ordered-items-check.ts:19` | Lo vuelve a rechazar al confirmar |
| `sales/domain/order/lines/sales-order-references.ts:68` | `ServiceNotSellableError` al escribir la línea |
| `sales/domain/order/posting/stock-reservation.ts:41` | Lo vuelve a rechazar al confirmar |
| `inventory/domain/stock/posting/stock-movements.ts:78` | `ServiceHasNoStockError`: un servicio nunca mueve existencia |
| `sales/domain/invoice/invoice.entity.ts:91` | La factura arma sus líneas **solo con las del despacho** |

Consecuencia: un servicio se puede crear en el maestro y no sirve para nada. No se puede vender una instalación
junto al equipo, ni registrar un flete en la orden de compra.

## 2. Reglas del compañero

Su artículo tiene cuatro tipos y `service` es uno: «`service` (servicio: no afecta stock)»
([inventario.md](https://github.com/verlumyx/erp/blob/main/docs/inventario.md)). Sus líneas lo aceptan sin
restricción, y la regla que lo hace posible es **una sola función**, `Item::movesStock()`, que para `service` y
`non_inventoried` devuelve falso.

Lo importante es que lleva **dos cuentas por línea, y no miden sobre lo mismo**
([ventas.md](https://github.com/verlumyx/erp/blob/main/docs/ventas.md)):

> «Lo facturado se mide contra **todas** las líneas —un servicio se factura igual que un tornillo—, pero lo
> despachado **solo contra las líneas que llevan existencia** (`Item::movesStock()`). Un servicio o un artículo no
> inventariado no sale nunca en un Despacho: el despacho espejo ni siquiera los incluye, y `dispatchable-lines` los
> da por saldados. Contarlos en `dispatched_percent` dejaría el avance por debajo del 100 % con toda la mercancía
> ya entregada, y el pedido no cerraría jamás. Un pedido que solo vende servicios nace con
> `dispatched_percent = 100`: no hay nada que sacar.»

Lo mismo, simétrico, en compras: «Una orden que solo pide servicios nace con `received_percent = 100`: no hay nada
que esperar» ([compras.md](https://github.com/verlumyx/erp/blob/main/docs/compras.md)).

**Por dónde entra el servicio a su factura:** no por el despacho. Cada documento tiene su propia ruta —
`dispatchable-lines` para el despacho, `invoiceable-lines` para la factura — y la segunda incluye los servicios. Su
factura se arma desde el **pedido**, no desde el despacho. El pedido se cierra cuando **las dos** cuentas llegan al
total.

Dato útil: cuando quiso modelar el flete de una importación, lo resolvió con «una línea con un artículo de tipo
`service`… Las facturas ya aceptaban servicios, así que no hizo falta nada nuevo»
([logistica.md](https://github.com/verlumyx/erp/blob/main/docs/logistica.md)).

## 3. Qué hace un ERP

| ERP | Cómo llama al artículo sin existencia | Cómo llega a la factura |
|---|---|---|
| **Odoo** | Tipo de producto **Service** | Por la *Invoicing Policy*: «Invoice what is ordered… customers are invoiced once the sales order is confirmed», frente a facturar lo entregado. Para un servicio se usa lo pedido, porque no hay entrega que medir |
| **ERPNext** | `Is Stock Item` = 0 | «Service items do not require delivery and are invoiced directly from the Sales Order» |
| **Business Central** | Tipo **Service** en la ficha | No necesita documento de entrega |
| **SAP Business One** | Tipo de fila **Service** | «For service rows, no warehouse is selected»: esa fila no genera entrada ni entrega |

**El consenso de los cuatro:** un servicio **nunca necesita un documento de movimiento físico** para llegar a la
factura; esta lo toma del documento comercial.

**Y la prueba de qué pasa cuando eso falta:** ERPNext tiene el defecto documentado en su propio repositorio —
«Even though the service items have been fully invoiced: The Sales Order still shows a quantity pending delivery…
The order remains Open or Partially Fulfilled»
([frappe/erpnext#59071](https://github.com/frappe/erpnext/issues/59071)). Es exactamente el pedido que no cierra
jamás que el compañero describe y evita.

## 4. Matriz

| Regla | Sistema | Compañero | ERP | Veredicto |
|---|---|---|---|---|
| El artículo puede ser un servicio | ✅ Existe el tipo | ✅ | ✅ | **Coinciden** |
| Un servicio mueve existencia | ❌ Nunca (correcto) | ❌ Nunca | ❌ Nunca | **Ya correcto** |
| Un servicio se puede pedir y comprar | ❌ **Se rechaza** | ✅ | ✅ | **Falta.** Es el hueco de esta fase |
| Su línea cuenta para recibido/despachado | — | ❌ No cuenta | ❌ No | **Del compañero** |
| Un documento solo de servicios queda abierto | — | ❌ Nace al 100 % | ERPNext sí: es un defecto suyo | **Del compañero** |
| Un servicio llega a la factura | ❌ Imposible | Desde el pedido | Desde el pedido | **A decidir** (§5): nuestra factura nace del despacho |

## 5. Decisiones de Rafael (18-sep-2026)

1. **Por dónde entra el servicio a la factura**: la factura **sigue naciendo de un despacho** y **arrastra las
   líneas de servicio de ese pedido que aún no se han facturado**. Para saber cuáles faltan, la línea del pedido
   lleva una cuenta de lo facturado, como el compañero. **Un pedido que solo tiene servicios se factura
   directamente, sin despacho.** Se descartó rehacer la facturación entera desde el pedido (el diseño del
   compañero) porque toca Ventas, Cuentas por cobrar y Reportes.
2. **Compras, simétrico**: la orden de compra acepta servicios, su línea no cuenta para el estado de recibido, y
   la entrada de mercancía no los incluye porque no hay nada que recibir.

### 5.1 Diseño que sale de las decisiones

**Una sola regla, en un solo sitio**: un artículo mueve existencia si no es un servicio. De ahí cuelga todo lo
demás, igual que el `Item::movesStock()` del compañero.

| Pieza | Qué cambia |
|---|---|
| Línea del pedido y de la orden | Aceptan un servicio. La cantidad sigue siendo obligatoria (una instalación, dos horas) |
| Reserva y confirmación | La línea de servicio no reserva existencia ni se comprueba contra ella |
| Despacho y entrada | **No ofrecen líneas de servicio**: no hay nada que sacar ni que recibir |
| Estado recibido / despachado | Se calcula **solo sobre las líneas que mueven existencia**. Un documento solo de servicios nace saldado |
| `sales_order_lines.invoiced_quantity` | Nueva cuenta: cuánto de esa línea ya se facturó |
| Factura | Sus líneas son las del despacho **más** los servicios del pedido pendientes de facturar |
| Factura de un pedido sin mercancía | Se emite desde el pedido, sin despacho |
