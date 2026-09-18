# Tema: listas de precio

**Pregunta** (del [checklist](../README.md#temas-por-investigar-y-ubicar)): en qué módulo vive el maestro de
precios y cómo se resuelve el precio de una línea. Se investiga antes de construir, como pidió Rafael.

**Fecha:** 18-sep-2026. **Estado:** investigado; esperando las decisiones de Rafael (§6).

---

## 1. Qué hace hoy el sistema

**No hay ningún precio guardado en ningún maestro.** El precio nace escrito a mano en la línea del pedido y
desde ahí se propaga:

| Pieza | Dónde | Qué hace |
|---|---|---|
| Artículo | `inventory/domain/item/item.entity.ts:13` | No tiene precio ni costo. Tiene impuesto de venta y de compra, unidades y reglas de reposición |
| Puerto del catálogo que ve Ventas | `sales/domain/catalog/sales-catalog.ts:8` | `SellableItem` expone `taxRate` y `units`. **Ningún precio** |
| Línea del pedido | `sales/domain/order/lines/sales-order-references.ts:90` | `unitPrice: UnitPrice.of(input.unitPrice)` — el único sitio del sistema donde nace un precio, y sale del formulario |
| Impuesto de la línea | `sales-order-references.ts:91` | `taxRate: TaxRate.of(item.taxRate)` — **lo dicta el maestro y la línea lo congela**. Es el precedente exacto de lo que haría una lista de precio |
| Factura | `sales/domain/invoice/invoice.entity.ts:93` | Copia `unitPrice` y `taxRate` de la línea del pedido. No se vuelve a pedir |
| Decimales | `sales-order-creator.ts:46` → `ensurePriceDecimals` | Los del ajuste `price_decimals` de la empresa (0 a 8, por defecto 6). Se comprueba **solo al capturar el pedido** |
| Moneda | `sales-order-creator.ts:48` | El precio se escribe **en la moneda del documento**. Nada lo convierte; las tasas solo reexpresan importes ya calculados |
| Unidad | `sales/domain/order/sales-order-line.ts:114` | El subtotal se calcula con `quantity`, **no** con `baseQuantity`: el precio es **por la unidad de venta elegida**. `baseQuantity` solo sirve para reservar y despachar |
| Cliente | `sales/domain/customer/customer.entity.ts:31` | Solo plazo de pago y límite de crédito. **Sin lista, sin descuento, sin moneda preferida** |
| Pantalla | `apps/web/src/sections/sales/sales-orders-board.tsx:471` | Campo de texto libre; nace vacío y **no se rellena al elegir el artículo** |

Consecuencia práctica: **el mismo artículo se vende a un precio distinto cada vez que alguien lo teclea mal**, y
no hay forma de saber cuál era el precio correcto.

## 2. Reglas del compañero

Su modelo es deliberadamente simple y reparte el maestro en dos tablas.

- **`app_price_lists`** ([catalogo.md §2](https://github.com/verlumyx/erp/blob/main/docs/catalogo.md)) vive en el
  **catálogo** y solo tiene `name` y `description`. Cita: «La lista solo **nombra el conjunto**: no guarda precios
  ni condiciones.» Único `(company_id, name)`.
- **`app_item_prices`** ([inventario.md §1.2](https://github.com/verlumyx/erp/blob/main/docs/inventario.md)) vive
  en **inventario**, una fila por artículo y lista: `price` (`decimal(18,6)`, «Precio unitario en la **unidad base**
  del artículo»), `currency` (ISO 4217), `status`. Único `(item_id, price_list_id)`.
- **Sin vigencia.** Cita: «Hay **un solo precio por artículo y lista**: no se guarda vigencia, el histórico vive en
  los documentos ya emitidos.»
- **Precio mínimo en el artículo**, no en la lista: `app_items.min_price` (`decimal(18,6)`), «Precio mínimo
  permitido; bloquea descuentos excesivos». Dos reglas lo usan: `app_item_prices.price` no puede quedar por debajo,
  y en la línea del pedido «No se permite `unit_price < item.min_price` sin el permiso correspondiente»
  ([ventas.md](https://github.com/verlumyx/erp/blob/main/docs/ventas.md)).
- **Resolución**: «precio del artículo en `client.price_list_id` → precio del artículo en la lista por defecto de la
  empresa». El tipo de cliente **no interviene** (`app_client_types` es «solo clasificación»).
- El **pedido lleva su propia lista** (`app_sales_orders.price_list_id`), que puede diferir de la del cliente.
- La línea guarda **`list_price` junto a `unit_price`**: el precio de lista antes del descuento, «para medir el
  descuento real».
- **Congelado**: «El precio se **copia** a la línea del documento al confirmarlo; cambiarlo después no altera
  documentos ya emitidos.»
- El cliente tiene un `discount_percent` fijo; **no hay descuento escalonado por cantidad**.
- Para corregir un precio ya facturado existe la nota de crédito con motivo `price_correction`.

## 3. Qué hace un ERP

Investigado por dos vías independientes (un agente con documentación oficial y `agy` como segunda opinión); donde
no coincidieron, se dice.

| | Business Central | Odoo | ERPNext | SAP Business One |
|---|---|---|---|---|
| **Dónde vive** | Transversal compra y venta | **Solo ventas** (compras usan otro mecanismo en la ficha del producto) | Transversal, marcada `Selling` o `Buying`: «A Price List is a collection of Item Prices either Selling, Buying, or both» ([docs](https://docs.frappe.io/erpnext/user/manual/en/price-lists)) | Transversal, cuelga de gestión de artículos |
| **Cabecera** | Moneda, si incluye impuestos, borrador/activo, a quién aplica | Nombre, **moneda**, grupos de país, activo | Nombre, moneda, tipo, activo | Nombre, moneda, y un **factor** que encadena una lista con otra |
| **Línea** | Artículo, precio, unidad, cantidad mínima, fechas | Producto o categoría, cantidad mínima, fechas, y el precio como fijo, descuento o fórmula | `Item Price`: artículo, tarifa, **unidad** («A price is always specific to a certain UOM»), `Valid From`/`Valid Upto` | Artículo, unidad, precio. Vigencia y volumen van aparte, en *Special Prices* |
| **Moneda** | En la cabecera | En la cabecera | En la cabecera | En la cabecera, y admite monedas adicionales en la misma fila |
| **Cliente** | Aplica a cliente, grupo o campaña | Campo en la ficha del cliente; sin él, la lista por defecto | Se etiqueta al cliente; los empates los rompe `Pricing Rule` con un campo **`Priority`** | Se asigna en el maestro del socio |
| **Empate** | **Mejor precio** (el más bajo) | Por especificidad, con la lista por defecto al final | Prioridad explícita | **Jerarquía rígida**: precios especiales → descuentos por período y volumen → lista del cliente |
| **En la línea** | Sugerido y **editable** | Editable: «Pricelists suggest certain prices, but they can always be overridden» | Editable | Editable, con control de **ganancia bruta** que avisa o impide vender bajo el margen |
| **Si no hay precio** | «either the last direct cost or the unit price from the item card is inserted» | Cae a la lista por defecto | Las dos fuentes discrepan (una dice que no está documentado, otra que llega en cero): **no concluyente** | Llega en cero |

> Las citas de SAP Business One vienen de una fuente secundaria especializada: `help.sap.com` respondió 403.
> Se marcan como tales y no sostienen ninguna decisión por sí solas.

**Consenso de los cuatro:** la moneda vive en la **cabecera** de la lista; la línea ata artículo + precio +
**unidad de medida**; el precio del documento es **sugerido y editable**, nunca bloqueado; y existe siempre un
**precio base del artículo** o una lista por defecto que hace de salvavidas cuando ninguna regla aplica.

**Divergencia de fondo:** cuánta condicionalidad admite una lista. Odoo y BC llegan a fórmulas y descuentos por
volumen; el compañero se queda en «un precio por artículo y lista». Para el alcance de este ERP, lo segundo.

## 4. Matriz

| Regla | Sistema | Compañero | ERP | Veredicto |
|---|---|---|---|---|
| Existe un maestro de precios | ❌ No hay ninguno | ✅ Lista + precio por artículo | ✅ Los cuatro | **Falta.** Es el hueco que abre esta fase |
| La lista solo nombra el conjunto | — | ✅ Nombre y descripción | ❌ La cabecera lleva moneda y condiciones | **Del ERP**: la moneda en la cabecera evita listas que mezclan monedas |
| Precio por artículo y lista | — | ✅ Único `(item, lista)` | ✅ | **Coinciden** |
| Vigencia por fechas | — | ❌ Sin vigencia | ✅ Tres de cuatro | **Del compañero** para este alcance; la vigencia se anota en `FUTURE.md` |
| Precio en unidad base | Precio **por unidad elegida** (`sales-order-line.ts:114`) | ✅ Unidad base | ERPNext: precio **por unidad** | **A decidir** (§6.3): hoy nuestro subtotal multiplica por la cantidad en la unidad de venta |
| Moneda del precio | La del documento | En cada fila de precio | En la cabecera de la lista | **Del ERP** |
| Lista del cliente | ❌ El cliente no tiene nada | ✅ `client.price_list_id` | ✅ | **Falta** |
| Lista del pedido | ❌ | ✅ `order.price_list_id` | ✅ (BC, SAP) | **Falta** |
| Precio mínimo | ❌ | ✅ En el artículo | Solo SAP, como margen | **A decidir** (§6.4) |
| Precio sugerido y editable | La persona lo escribe entero | ✅ Sugerido, editable con tope | ✅ Los cuatro | **Coinciden**: sugerir, no imponer |
| Precio congelado en la línea | ✅ Ya lo hace | ✅ | ✅ | **Ya correcto** |
| Factura al precio del pedido | ✅ `invoice.entity.ts:93` | ✅ | ✅ | **Ya correcto** |

## 5. Propuesta

**Dónde vive.** Igual que el compañero, y encaja con lo que ya decidimos (los artículos viven en Inventario):

- **`price_lists` en el contexto `catalog`**, al lado de categorías, unidades, impuestos y bodegas. Es un catálogo:
  código, nombre, descripción, moneda, marca de lista por defecto y estado.
- **`item_prices` en el contexto `inventory`**, colgando del artículo, una fila por artículo y lista. Es lo que ya
  hacen las unidades y las reglas de reposición del artículo: se reemplazan enteras desde su maestro.
- **Ventas no guarda precios**: los lee por un puerto, como ya lee el impuesto (`SalesCatalog`).

**Cómo se resuelve el precio de una línea**, en este orden:

1. La lista del **pedido**, si quien captura eligió una.
2. La lista del **cliente**.
3. La lista **por defecto** de la empresa.

Si el artículo no tiene precio en la lista que resultó, **no se sugiere nada** y el campo queda en blanco para que
lo escriba la persona — que es exactamente lo que pasa hoy, así que no rompe nada de lo construido.

**El precio es una sugerencia.** Llega al formulario relleno y se puede cambiar; la línea guarda lo que se escribió
y además el precio de lista, para poder medir el descuento real (como el compañero). Congelarlo ya funciona: la
línea lo guarda y la factura lo copia del pedido.

**Moneda.** La lista tiene la suya. Si el pedido va en otra moneda, el precio se convierte **por el bolívar con las
tasas del documento**, que es la misma regla que ya usa el cobro en moneda distinta a la de la factura. Así una
empresa lleva una sola lista en dólares y vende en euros sin mantener dos.

## 6. Decisiones que tiene que tomar Rafael

1. **Dónde vive el maestro**: ¿la lista en Catálogo y el precio colgando del artículo en Inventario (propuesta), o
   todo junto en Ventas?
2. **Alcance de la lista**: ¿un precio por artículo y lista, sin vigencia ni cantidad mínima (compañero), o con
   vigencia desde/hasta (tres de los cuatro ERP)?
3. **Unidad del precio**: nuestro subtotal usa la cantidad **en la unidad elegida**. ¿El precio de la lista se
   guarda por unidad base y se multiplica por el factor al sugerirlo, o se carga un precio por cada unidad?
4. **Precio mínimo**: ¿se agrega al artículo como el compañero, y en qué moneda se compara?
5. **Moneda de la lista frente a la del documento**: ¿convertir por el bolívar (propuesta), o exigir una lista en
   la moneda del documento?
6. **Precios de compra**: ¿el mismo mecanismo sirve para el costo de proveedor, o eso queda fuera de esta fase?

## 7. Decisiones de Rafael (18-sep-2026)

1. **Ubicación**: la lista vive en **Catálogo** (código, nombre, descripción, moneda, marca de por defecto, estado)
   y el precio por artículo y lista cuelga del **artículo, en Inventario**. Ventas no guarda precios: los lee por
   un puerto, igual que ya lee el impuesto.
2. **Alcance**: **un solo precio por artículo y lista**, sin vigencia por fechas ni cantidad mínima. El histórico
   vive en los documentos ya emitidos, que congelan su precio. La vigencia queda anotada en `FUTURE.md`.
3. **Unidad**: el precio se guarda **en la unidad base** y se multiplica por el factor de conversión al sugerirlo.
   Una sola fila por artículo y lista, aunque el artículo se venda en varias unidades.
4. **Moneda**: si el pedido va en una moneda distinta a la de la lista, el precio se **convierte por el bolívar**
   con las tasas del documento — la misma regla que ya usa el cobro en moneda distinta a la de la factura.
5. **Precio mínimo**: **sí**, en el artículo y **en la moneda de la empresa**. Bloquea dos cosas: cargar un precio
   de lista por debajo, y escribir en la línea del pedido un precio menor. Se compara convirtiendo con las tasas
   del documento.
6. **Precios de compra**: **fuera de esta fase**. La orden de compra sigue con el costo escrito a mano. Anotado en
   `FUTURE.md`.

### 7.1 Diseño que sale de las decisiones

| Pieza | Contexto | Qué lleva |
|---|---|---|
| `price_lists` | `catalog` | Código, nombre, descripción, moneda, `is_default`, estado. Única por empresa y nombre. Una sola lista por defecto |
| `item_prices` | `inventory` | Artículo, lista, precio `decimal(18,6)` **en la unidad base**. Única por artículo y lista |
| `items.min_price` | `inventory` | `decimal(18,6)` opcional, en la moneda de la empresa |
| `customers.price_list_id` | `sales` | Lista del cliente, opcional |
| `sales_orders.price_list_id` | `sales` | Lista aplicada al pedido, opcional; puede diferir de la del cliente |
| `sales_order_lines.list_price` | `sales` | El precio que sugirió la lista, junto al que se escribió: así se mide el descuento real |

**Orden de resolución**: lista del pedido → lista del cliente → lista por defecto de la empresa. Si el artículo no
tiene precio en la lista que resultó, no se sugiere nada y el campo queda en blanco, como hoy.

**Cadena del cálculo**, en este orden: precio de la lista (unidad base) → × factor de la unidad elegida →
convertido a la moneda del documento por el bolívar → redondeado a los `price_decimals` de la empresa.

## 8. Validación de las decisiones (18-sep-2026)

Rafael pidió comprobar cada decisión contra el compañero y contra los ERP antes de construir, sobre todo las tres
donde el diseño se separa de lo investigado. Dos investigaciones independientes por pregunta, y **cada hallazgo del
compañero verificado leyendo su código**, no su documentación.

### 8.1 Convertir el precio a la moneda del documento — **validado**

Es una de las dos escuelas, no una rareza:

- **ERPNext convierte por triangulación**, igual que la propuesta: su pedido distingue la moneda de la lista de la
  del documento y guarda una tasa aparte (`plc_conversion_rate`) para llevar el precio de la lista a la moneda de
  la empresa y de ahí a la del pedido.
- **Business Central también convierte**, pero partiendo del precio base del artículo, que siempre está en moneda
  local: «the system defaults to the Unit Price defined manually on the Item Card».
- **Odoo fuerza la coincidencia**: elegir una lista en euros cambia la moneda del pedido a euros.
- **SAP** evita el problema guardando hasta tres monedas en la misma fila de precio.
- **El compañero convierte** con las tasas del día — pero **solo en el navegador**
  ([`useSalesOrderForm.ts`](https://github.com/verlumyx/erp/blob/main/resources/js/pages/sales-orders/hooks/useSalesOrderForm.ts),
  `resolvePrice`). Su backend no vuelve a resolver el precio: acepta el que llegue del formulario. Un comentario de
  su código promete una revalidación que el servicio no hace.

**Lo que nos llevamos:** convertir, como ERPNext, y **resolver el precio en el servidor**, no solo en la pantalla.

### 8.2 Precio por unidad base multiplicado por el factor — **validado, y arregla un defecto del compañero**

Su documentación dice que `price` es «el precio unitario en la unidad base del artículo», pero su `resolvePrice`
**no recibe la unidad de la línea ni el factor de conversión**: devuelve el precio de la lista tal cual. Si un
artículo se vende en cajas de doce, cobra el precio de la pieza. No se nota porque su formulario preselecciona la
unidad base. La multiplicación por el factor sí existe en su código, pero en un solo sitio y para otra cosa: valorar
una devolución sin factura al costo promedio, donde su propio comentario explica el porqué — «el promedio está en
unidad base y `unit_price` es por unidad de la línea».

**Nosotros estamos más expuestos**: nuestro subtotal ya multiplica el precio por la cantidad **en la unidad elegida**
(`sales-order-line.ts:114`), así que sin la conversión el error aparecería en cuanto alguien venda en cajas.

### 8.3 Precio mínimo — **el compañero y los ERP no coinciden**

- **El compañero** tiene un número fijo por artículo y lo hace cumplir, pero comparando **números crudos**:
  `unit_price < min_price` sin convertir moneda
  ([`ValidatesSalesOrderPayload.php`](https://github.com/verlumyx/erp/blob/main/app/Modules/SalesOrder/Requests/Concerns/ValidatesSalesOrderPayload.php)),
  y en ninguna parte de su documentación dice en qué moneda está ese mínimo.
- **Los ERP no tienen precio mínimo fijo.** Atan el piso al costo: SAP calcula la ganancia bruta y dispara una
  aprobación, Odoo permite un piso de margen en la regla de precio, y ERPNext avisa cuando el precio de venta baja
  del precio de compra. Ninguno documenta un bloqueo duro.

**Decisión de Rafael:** el **mínimo fijo por artículo**, cerrando el hueco del compañero — se guarda en la moneda de
la empresa y la comparación convierte el precio de la línea antes de comparar. El margen sobre el costo se descartó
porque un artículo recién creado, o sin compras todavía, tiene costo cero y cualquier margen lo rechazaría. Queda
anotado en `FUTURE.md`.

### 8.4 Lo que copiamos del compañero

Cuando cambia el cliente o la lista, **un precio pactado a mano se respeta**: su formulario compara `unit_price` con
`list_price` y solo pisa el precio si eran iguales. Es el motivo real de guardar las dos columnas, y lo adoptamos.
