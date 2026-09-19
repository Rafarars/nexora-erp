# Inventario

**Qué** artículos maneja la empresa, **cuánto** hay de cada uno en cada bodega, **cuánto vale** y
**cómo** se llegó a eso.

Contexto: `apps/api/src/contexts/inventory` · Pantallas: `/inventario/*` · Informe técnico:
[`../H3-INVENTARIO.md`](../H3-INVENTARIO.md)

| Submódulo | Tabla | Prefijo | Qué es |
|---|---|---|---|
| Artículos | `items`, `item_units` | `ART` | El maestro de productos y servicios, con sus unidades |
| Ajustes | `adjustments`, `adjustment_lines` | `AJU` | Documento que corrige existencias: conteos, mermas, hallazgos |
| Kardex | `inventory_movements` | — | Una fila por cada cambio de existencia, inmutable |
| Existencias | `item_stocks` | — | Saldo actual por artículo y bodega, derivado del kardex |

**Depende de** Catálogo (categorías, impuestos, unidades y bodegas), que lee por sus propios puertos
(`CatalogReferences`, `InventoryCatalog`) sin importar el código del catálogo. El catálogo, a su vez,
pregunta a las tablas de artículos si uno activo usa una categoría, un impuesto o una unidad antes de
desactivarla (`ItemUsage`).

---

## Principios

1. **Un solo motor mueve existencia** (`StockMovements`). Lo usan el ajuste y, desde el H4, la
   entrada de mercancía de [Compras](compras.md), que se lo pide al inventario por un contrato
   publicado, y el despacho de [Ventas](ventas.md).
2. **El kardex no se edita ni se borra.** Un error se corrige con un movimiento de contrapartida
   que cita al original.
3. **La existencia es derivada.** Siempre es igual a la suma de sus movimientos, y el saldo del
   último movimiento es la existencia. Hay pruebas que lo exigen.
4. **Nunca queda negativa.** Lo impide el dominio, lo impide un bloqueo de filas bajo concurrencia
   y lo impide la base (`CHECK quantity >= 0`).
5. **Cantidades y costos en enteros escalados**: la suma cuadra exacta, sin redondeos de coma
   flotante.

---

## 1. Artículos

El maestro de productos y servicios. Vive en el inventario desde la revisión de septiembre de 2026;
antes estaba en el catálogo. SAP Business One, Odoo y Business Central lo muestran bajo Inventario.
La categoría, el impuesto y las unidades siguen en el [catálogo](catalogo.md) y se leen por el puerto
`CatalogReferences`.

| Campo | Tipo | Regla |
|---|---|---|
| `sku` | texto(60) | Obligatorio, único por empresa. **Se guarda en mayúsculas**; solo letras, dígitos, `.`, `-` y `_` |
| `barcode` | texto(60) | Opcional, **único por empresa**. Se guarda en mayúsculas, con las mismas letras y signos que el SKU |
| `name` | texto(200) | Obligatorio |
| `description` | texto(1000) | Opcional |
| `type` | `inventoried` \| `service` | Inventariado tiene existencia; **un servicio se compra y se vende pero nunca tiene stock**: su línea no se recibe ni se despacha, y no deja el documento abierto ([ventas.md §2.5](ventas.md#25-servicios)) |
| `is_purchasable` | sí/no | Por defecto sí. En **no**, una orden de compra lo rechaza (`ItemNotPurchasableError`). **No se puede quitar** con órdenes de compra abiertas (`ItemStopsBeingTradedError`) |
| `is_sellable` | sí/no | Por defecto sí. En **no**, un pedido de venta lo rechaza (`ItemNotSellableError`). **No se puede quitar** con pedidos de venta abiertos |
| `category_id` | categoría | Opcional |
| `sales_tax_id` | impuesto | Opcional. **El que se copia a la línea al venderlo** |
| `purchase_tax_id` | impuesto | Opcional. El que se copia a la línea al comprarlo |
| `min_price` | decimal(18,6) | Opcional. **Piso de venta, en la moneda de la empresa** |

### 1.1 Mínimos por bodega — `item_reorder_rules`

Cuánto se quiere tener del artículo **en cada bodega**, en su unidad base. Sin regla, el artículo no se
vigila en esa bodega.

| Campo | Tipo | Regla |
|---|---|---|
| `warehouse_id` | bodega | De la empresa y **activa**. Una sola regla por bodega |
| `min_quantity` | decimal(18,4) | Cero o más. Por debajo, el artículo aparece en **Bajo mínimo** |
| `max_quantity` | decimal(18,4) | Opcional. No puede ser menor que el mínimo |
| `reorder_quantity` | decimal(18,4) | Lo que se sugiere pedir. En cero, se sugiere lo que falta para el máximo |

**Por qué por bodega y no en el artículo:** lo que falta en la Principal no se cubre con lo que sobra en
la Norte. Así lo llevan Odoo (`stock.warehouse.orderpoint`), ERPNext (`Item Reorder`) y Business Central
(en el SKU, artículo + ubicación). El compañero los tiene planos en el artículo y **nadie los lee**; aquí
los consume el listado de bajo mínimo.

**Contra qué se compara el mínimo:** contra la existencia **proyectada**, no contra la física.

```
proyectada = existencia − reservado + en camino
```

- **Reservado**: lo pendiente de despachar de los pedidos de venta confirmados de esa bodega.
- **En camino**: lo pendiente de recibir de las órdenes de compra confirmadas para esa bodega.

Ambas cifras en unidad base, y solo de las líneas que mueven existencia: un servicio no reserva ni
llega. Comparar contra la física haría que el aviso pidiera comprar de nuevo lo que ya viene del
proveedor, y que callara sobre lo que ya está vendido. Es la cuenta de ERPNext (*Projected Qty =
Actual + Ordered − Reserved*) y de Odoo (la previsión de sus reglas de reabastecimiento). La
pantalla muestra las cuatro columnas —existencia, reservado, en camino y proyectada— para que el
número se pueda explicar.

**Lo que no se vigila:** los artículos inactivos, los **servicios** (no tienen existencia que reponer
aunque alguien les deje una regla) y las bodegas **desactivadas**.

### 1.2 Precios por lista — `item_prices`

Lo que cuesta el artículo en cada [lista de precio](catalogo.md#5-listas-de-precio). Una fila por
artículo y lista.

| Campo | Tipo | Regla |
|---|---|---|
| `price_list_id` | lista | De la misma empresa y activa |
| `price` | decimal(18,6) | Cero o más. **Siempre en la unidad base del artículo** |

**Reglas**

- **Un solo precio por artículo y lista**, sin vigencia por fechas: el histórico vive en los
  documentos ya emitidos, que congelan su precio. Es lo que hace el compañero; Business Central,
  Odoo y ERPNext admiten además ventanas de fechas, anotado en [FUTURE.md](../FUTURE.md).
- **El precio está en la unidad base.** Vender en otra unidad lo multiplica por el factor de
  conversión, y eso lo hace el pedido, no esta tabla. En el ERP del compañero el precio se guarda
  «en unidad base» pero se sugiere igual en cualquier unidad, así que una caja de doce se cobra al
  precio de la pieza; aquí no, porque nuestro subtotal multiplica por la cantidad **en la unidad de
  la línea**.
- **Los precios se reemplazan enteros** al guardar el artículo, como las unidades y los mínimos: la
  persona manda la tabla completa de la pantalla, no una lista de cambios.
- **Ningún precio puede quedar por debajo de `min_price`** (`PriceBelowMinimumError`). Es una
  invariante de la entidad: se comprueba al construirla, así que tampoco se puede subir el mínimo
  por encima de un precio ya cargado.
- **La lista tiene que existir y estar activa** (`PriceListNotFoundError`, `InactiveReferenceError`):
  cargar un precio en una lista apagada sería escribir algo que nadie va a sugerir.

**El precio mínimo va en la moneda de la empresa.** Las listas pueden estar en varias monedas, así
que un número sin moneda no se podría comparar con nada. Cuando una línea de pedido se escribe en
otra moneda, su precio se lleva a la de la empresa por el bolívar antes de compararlo
([Ventas](ventas.md#el-precio-de-una-línea)). El ERP del compañero tiene el mismo campo pero compara
números crudos, sin convertir, y su documentación no dice en qué moneda está.

### 1.3 Unidades del artículo — `item_units`

| Campo | Tipo | Regla |
|---|---|---|
| `unit_id` | unidad | De la misma empresa |
| `conversion_factor` | decimal(18,8) | Mayor que cero. Cuántas unidades base contiene 1 de esta unidad |
| `is_base` | sí/no | **Exactamente una** base, con factor 1 |

Ejemplo: agua con base «un» y «cja» con factor 24 → 1 cja = 24 un. Todo el stock se guarda en la
unidad base.

**Por qué ocho decimales:** con cuatro, una base «docena» daba 0,0833 por pieza y doce piezas sumaban
0,9996 docenas, no una. Con ocho, 0,08333333 × 12 = 0,99999996, que redondeado a las cuatro
diezmilésimas de las cantidades es exactamente 1.

**Y el cálculo usa los ocho**, no solo la columna: la conversión a unidad base multiplica por el
factor completo y redondea **una sola vez** al final. Recortar el factor a cuatro decimales antes de
multiplicar devolvía el mismo 0,9996 que se quería evitar, y convertía en **cero** un factor más fino
que 0,00005 —un gramo de un saco de 25 kg—, de modo que el documento entraba sin mover nada.

**El listado va por páginas.** `GET /api/v1/inventory/items` devuelve 20 por defecto (`limit` hasta 50,
`offset` desde 0) y, junto a los artículos, `total`, `limit`, `offset` y `hasMore`. `q` filtra por
código, SKU, nombre y código de barras, sin distinguir mayúsculas. **Ordena por nombre y, en el
empate, por identificador**: dos artículos pueden llamarse igual, y sin ese desempate una página
repetía lo que traía la anterior y el artículo saltado no aparecía en ninguna. La pantalla busca y pasa de página
por la URL, así que un listado se puede compartir tal como se ve. Los selectores de otros módulos
piden 50; con un maestro mayor harán falta selectores que busquen contra el servidor
([FUTURE.md](../FUTURE.md)).

**El SKU y el nombre viajan con la línea.** Cada línea de ajuste, orden, entrada, pedido, despacho y
factura guarda `item_sku` e `item_name` copiados del maestro al escribirse. Renombrar un artículo no
cambia lo que dice un documento ya emitido, que es lo que hacen Business Central, Odoo, ERPNext y
SAP, y lo que hace falta para reimprimir una factura tal como se emitió. El `item_id` sigue ahí para
los reportes y para volver al maestro.

**Por qué las banderas se validan en el dominio:** el compañero solo filtra el selector de la pantalla y lo
comprueba al guardar el documento; aquí la línea no se construye si el artículo no se compra o no se vende,
así que ningún camino (API, importación o pantalla) puede saltárselo.

**Por qué dos impuestos:** un artículo puede comprarse exento y venderse con IVA. La orden de compra
copia el de compra y el pedido de venta copia el de venta; si falta, la línea va sin impuesto. Es lo
que hacen el compañero y SAP Business One.

**Reglas**

- Al menos una unidad, **exactamente una base con factor 1** y **ninguna repetida**
  (`InvalidItemUnitsError`). El factor puede ser menor que 1 (medio kilo).
- **Todo lo que referencia existe en su empresa y está activo** al crear. Al **editar** se tolera
  conservar una referencia que se desactivó después: corregir la descripción no obliga a cambiar
  la categoría.
- **Reactivar** un artículo exige que sus referencias estén activas, o volvería a los selectores
  con algo que ya no se ofrece.
- **No se desactiva un artículo con existencia** (`ItemWithStockError`, desde el H3).
- **No se desactiva un artículo que usan órdenes de compra o pedidos de venta abiertos**
  (`ItemInOpenDocumentsError`): confirmados o a medias, con algo pendiente de ese artículo. Un
  borrador no cuenta: todavía no prometió nada y se revalida al confirmarlo. Sin esta regla la
  entrada o el despacho fallaban después, con el artículo ya inactivo.
- **Con movimientos de inventario, no cambia su unidad base ni su tipo** (`ItemWithMovementsError`,
  desde el H3): el kardex guarda cantidades en esa unidad. Sí se pueden añadir unidades
  secundarias o cambiar nombre, categoría e impuesto.
- **Mientras una orden o un pedido abierto usa una unidad, esa unidad no se quita ni cambia su
  factor** (`ItemUnitInOpenDocumentsError`), y el artículo no cambia de tipo
  (`ItemInOpenDocumentsError`). La orden guardó 10 cajas como 240 unidades: con una caja de 12
  anunciaría en camino otra cosa. Recibida o anulada la orden, la unidad vuelve a quedar libre.
- **Dejar de comprarlo o de venderlo es, para un documento vivo, lo mismo que darlo de baja**
  (`ItemStopsBeingTradedError`): quitar «se compra» con órdenes de compra abiertas se rechaza, y
  quitar «se vende» con pedidos de venta abiertos, también. **Cada lado mira los suyos**: un pedido
  de venta no impide dejar de comprarlo. Los borradores no cuentan —no prometieron nada y se
  revalidan al confirmarse— y volver a ofrecerlo nunca estorba a nadie.
- **Editar y desactivar bloquean la fila del artículo** mientras miran su existencia, su kardex y
  sus documentos abiertos. Quien confirma un documento o mueve existencia la bloquea en modo
  compartido: el cambio y el documento van en fila, y el segundo ve lo que dejó el primero. Así
  nunca queda un artículo inactivo con existencia, ni con la base cambiada bajo su primer
  movimiento.
- **Una sola unidad base, también en la base de datos**: el índice único parcial
  `item_units_one_base_per_item` la garantiza para quien escriba sin pasar por el dominio.

---

## 2. Ajustes

### 2.0 Para qué sirve un ajuste

Un ajuste **corrige el sistema cuando no coincide con lo que hay físicamente**. No es la forma de
meter mercancía comprada.

| Situación | Documento correcto |
|---|---|
| Carga inicial: el sistema arranca y ya hay mercancía en la bodega | **Ajuste** de entrada («Conteo inicial») |
| Un conteo encuentra más o menos de lo registrado | **Ajuste** de entrada o de salida |
| Mercancía rota, vencida, perdida o robada (merma) | **Ajuste** de salida |
| Aparece mercancía que no estaba registrada (hallazgo) | **Ajuste** de entrada |
| Llega mercancía de un proveedor | **Entrada de mercancía** ([compras.md](compras.md)), no un ajuste |
| Sale mercancía a un cliente | **Despacho** ([ventas.md](ventas.md)), no un ajuste |

**Por qué importa la diferencia.** La entrada queda ligada al proveedor, a la orden y a su costo
real, y actualiza lo que viene en camino. Un ajuste no dice de dónde vino la mercancía: si se usa para
compras, se pierde esa trazabilidad y lo pendiente de las órdenes nunca se cierra.

Antes del H4 no existía compras, y el ajuste era la única forma de dar existencia a un artículo.
Desde el H4, lo comprado entra por su entrada.

Referencias: la documentación de [verlumyx/erp](https://github.com/verlumyx/erp/blob/main/docs/inventario.md)
(«cuadres, mermas y hallazgos») y la de
[Odoo](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/count_products.html).

### 2.0.1 Un ajuste de salida y las reservas de ventas

**Comportamiento actual:** un ajuste de salida **no mira las reservas** de los pedidos de venta. El
inventario no conoce ventas.

Ejemplo: hay 10 teléfonos y un pedido confirmado reservó 8. Un conteo encuentra 5 y se confirma un
ajuste de salida de 5.

1. El ajuste se confirma: la existencia queda en **5**.
2. La disponibilidad muestra existencia 5, reservado 8 y **disponible 0**. Nunca muestra negativos.
3. Al confirmar el despacho de los 8, se rechaza con **«La bodega ya no tiene la existencia de este
   despacho»** y no cambia nada.
4. Para seguir: despachar solo lo que hay (editando el borrador del despacho) o anular el pedido si
   no se va a poder cumplir.

**Por qué es así.** Un ajuste de salida registra algo que **ya pasó**: si los teléfonos se rompieron,
se rompieron aunque estuvieran vendidos. Bloquear el ajuste dejaría al sistema diciendo que hay
mercancía que no existe. Odoo hace lo mismo: aplica el ajuste y las entregas afectadas pierden su
reserva.

**Mejoras anotadas** (en `FUTURE.md`): avisar al confirmar el ajuste qué pedidos quedan sin
existencia, y un motivo obligatorio en cada ajuste (conteo inicial, conteo, merma, daño, hallazgo).

### 2.1 Cabecera — `adjustments`

| Campo | Tipo | Regla |
|---|---|---|
| `code` | `AJU000001` | Asignado al crear |
| `warehouse_id` | bodega | De la empresa y **activa** |
| `adjustment_date` | fecha | Por defecto hoy. **No puede ser futura** |
| `notes` | texto(500) | Opcional |
| `status` | `draft` \| `confirmed` \| `cancelled` | Ver ciclo de vida |
| `confirmed_at`, `cancelled_at` | fecha y hora | Cuándo cambió de estado |

### 2.2 Líneas — `adjustment_lines`

| Campo | Tipo | Regla |
|---|---|---|
| `line_number` | entero | Orden dentro del ajuste |
| `item_id` | artículo | De la empresa, **activo** e **inventariado** (un servicio no tiene existencia) |
| `unit_id` | unidad | **Una de las unidades del artículo** |
| `direction` | `in` \| `out` | Entrada o salida |
| `quantity` | decimal(18,4) | Mayor que cero, en la unidad de la línea |
| `base_quantity` | decimal(18,4) | `quantity × factor`, en la unidad base. Calculada, no se escribe |
| `unit_cost` | decimal(18,6) | **Solo en entradas**, opcional, por unidad de la línea |

**Reglas de las líneas**

- Al menos una línea (`EmptyAdjustmentError`).
- La cantidad base se redondea a 4 decimales; si queda en cero, se rechaza.
- **Una salida no lleva costo** (`CostOnOutgoingLineError`): se valora al costo promedio vigente.
- **Costo por unidad de la línea**: 2 cajas de 24 a 12 cada una entran como 48 unidades a 0,50.
- **Una entrada sin costo** se valora al costo promedio vigente (un hallazgo en un conteo).
- **Al confirmar**, con los artículos ya bloqueados, cada cantidad base tiene que seguir siendo
  `cantidad × factor` de hoy. Si el artículo cambió su unidad entre la revalidación y el bloqueo,
  el ajuste no se confirma (`StockItemChangedError`, 409) y se vuelve a intentar.

### 2.3 Ciclo de vida

```
          confirmar                 anular
borrador ───────────▶ confirmado ───────────▶ anulado
    │                                           ▲
    └───────────────── anular ──────────────────┘
```

| Estado | Mueve existencia | Se puede |
|---|---|---|
| Borrador | No | Editar (reemplaza todo), confirmar, anular |
| Confirmado | Ya la movió | Anular (escribe la contrapartida) |
| Anulado | — | Nada |

**Confirmar**

1. **Se revalida el borrador con el catálogo de hoy**: si el artículo se desactivó, se rechaza; si
   su caja pasó de 24 a 12, **también se rechaza** (`StockItemChangedError`): «1 caja» contada cuando
   traía 24 no entra como 12 sin que nadie lo vea. Se abre el borrador, se revisa, se guarda (guardar
   recalcula con el factor de hoy) y se confirma.
2. Cada línea mueve la existencia de su artículo en la bodega del ajuste, **en orden**.
3. Si una salida no alcanza (`InsufficientStockError`, 409), **no se escribe nada**: ni las líneas
   anteriores, ni el estado, ni la fila de existencia creada para bloquearla.
4. Un ajuste se confirma **una sola vez**, aunque se pida dos veces a la vez.

**Anular**

- Un **borrador** solo cambia de estado.
- Uno **confirmado** revierte cada movimiento que escribió, del último al primero, con otro que lo
  cita (`reversal_of_id`).
- Si la mercancía que entró **ya salió** por otro ajuste, revertir la entrada dejaría existencia
  negativa y se rechaza.
- **No se anula dos veces**: la contrapartida nunca se duplica (además, la base exige
  `reversal_of_id` único).

**Editar**

- Solo en borrador (`AdjustmentNotEditableError`).
- Si otra persona **confirma el ajuste mientras alguien edita el borrador**, el guardado de la
  edición se rechaza (409) en vez de devolverlo a borrador.

---

## 3. Kardex — `inventory_movements`

| Campo | Qué es |
|---|---|
| `sequence` | Número del movimiento dentro de su artículo y bodega: 1, 2, 3… sin huecos |
| `direction`, `quantity` | Entrada o salida, siempre positiva, en unidad base |
| `unit_cost` | Costo por unidad base del movimiento |
| `balance_quantity` | Existencia **después** del movimiento |
| `balance_average_cost` | Costo promedio **después** del movimiento |
| `origin_type`, `origin_id`, `origin_line_id` | Documento y línea que lo originaron: `adjustment`, `receipt` (entrada de compra) o `dispatch` (despacho de venta) |
| `reversal_of_id` | Movimiento que revierte, si es una anulación |
| `occurred_at` | Cuándo |

**Costo promedio ponderado**

- **Entrada**: `(existencia × promedio + cantidad × costo) / (existencia + cantidad)`. Ejemplo:
  10 a 2 y 30 a 4 → 40 a 3,50.
- **Salida**: se valora al promedio vigente y **no lo cambia**.
- **Revertir una entrada**: saca su valor del promedio. Si no queda nada, el promedio se conserva;
  si el valor restante fuera negativo, queda en cero.
- **Revertir una salida**: la devuelve al costo al que salió.

---

## 4. Existencias — `item_stocks`

| Campo | Qué es |
|---|---|
| `item_id`, `warehouse_id` | Clave, junto con la empresa |
| `quantity` | Existencia en unidad base, **nunca negativa** |
| `average_cost` | Costo promedio vigente |
| `last_sequence` | Último número de movimiento |

**Solo la escribe quien escribe el kardex**, en la misma transacción. La valoración de la pantalla
es `cantidad × costo promedio`, redondeada a céntimos.

---

### El motor compartido

Confirmar o anular cualquier documento pasa por el mismo servicio puro, `StockMovements`:

- `record(documento, líneas)`: cada línea, ya en unidad base, entra o sale de su existencia.
- `reverse(documento)`: revierte, del último al primero, los movimientos que ese documento escribió.
- **Ningún documento mueve la existencia de un artículo inactivo o de un servicio**
  (`InactiveStockItemError`, `ServiceHasNoStockError`), **tampoco al anular**: devolvería
  mercancía a algo que ya no se ofrece. Para anular, primero se reactiva el artículo.

El ajuste lo usa desde `AdjustmentConfirmation` y `AdjustmentCancellation`. La entrada de compra lo
usan, como el despacho, a través de `DocumentStockPosting` (`receive`, `release`, `reverse` y
`lockAvailable` para que ventas reserve), el contrato publicado que el inventario exporta y que recibe
la transacción de quien llama, para que documento y existencia cambien juntos. Ver
[compras.md §5](compras.md#5-cómo-se-mueve-la-existencia).

---

## 5. Concurrencia

Confirmar o anular ocurre en **una transacción** que:

1. **Bloquea la fila del ajuste**: dos confirmaciones del mismo ajuste esperan en fila y la segunda
   lo ve confirmado.
2. **Bloquea sus artículos en modo compartido**: editar o desactivar un artículo bloquea su fila
   para escribir, así que el cambio espera a la publicación o la publicación ve el cambio.
3. **Crea las existencias que falten y las bloquea en un orden fijo**: dos ajustes que sacan el
   mismo artículo esperan en fila y el segundo ve el saldo que dejó el primero; el orden fijo evita
   bloqueos mutuos.
4. Ejecuta las reglas del dominio y escribe ajuste, movimientos y existencias juntos.

Probado contra PostgreSQL: dos salidas de 6 sobre 10 enviadas a la vez → pasa una y queda 4. Y por
HTTP: desactivar un artículo mientras se confirma su entrada deja pasar solo una de las dos.

---

## 6. Reglas que protegen la existencia y los documentos abiertos

Las del artículo se explican en [§1](#1-artículos); la de la bodega vive en el catálogo.

| Regla | Error |
|---|---|
| No se desactiva un artículo con existencia | `ItemWithStockError` |
| No se desactiva una bodega con existencia | `WarehouseWithStockError` |
| No cambia la unidad base ni el tipo de un artículo con movimientos | `ItemWithMovementsError` |
| No se desactiva ni cambia de tipo un artículo que usan órdenes o pedidos abiertos | `ItemInOpenDocumentsError` |
| No se quita ni cambia de factor una unidad que usan órdenes o pedidos abiertos | `ItemUnitInOpenDocumentsError` |
| Dos artículos de una empresa no comparten código de barras | `DuplicateBarcodeError` |
| Una regla de reposición apunta a una bodega de la empresa, activa y sin repetir | `StockWarehouseNotFoundError`, `InactiveReferenceError`, `InvalidReorderRuleError` |
| No se compra un artículo marcado como «no se compra» | `ItemNotPurchasableError` |
| No se vende un artículo marcado como «no se vende» | `ItemNotSellableError` |

---

## 7. API y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Listar artículos | `GET /api/v1/inventory/items?q=&limit=&offset=` | `inventory.items.search` |
| Lo que está bajo mínimo | `GET /api/v1/inventory/low-stock?warehouseId=` | `inventory.stock.search` |
| Crear artículo | `POST /api/v1/inventory/items` | `inventory.items.create` |
| Editar artículo y sus unidades | `PUT /api/v1/inventory/items/:itemId` | `inventory.items.update` |
| Desactivar o reactivar artículo | `PUT /api/v1/inventory/items/:itemId/status` | `inventory.items.deactivate` |
| Listar ajustes | `GET /api/v1/inventory/adjustments` | `inventory.adjustments.search` |
| Crear borrador | `POST /api/v1/inventory/adjustments` | `inventory.adjustments.create` |
| Editar borrador | `PUT /api/v1/inventory/adjustments/:adjustmentId` | `inventory.adjustments.update` |
| Confirmar | `PUT /api/v1/inventory/adjustments/:adjustmentId/confirm` | `inventory.adjustments.confirm` |
| Anular | `PUT /api/v1/inventory/adjustments/:adjustmentId/cancel` | `inventory.adjustments.cancel` |
| Existencias | `GET /api/v1/inventory/stock?warehouseId=` | `inventory.stock.search` |
| Kardex | `GET /api/v1/inventory/items/:itemId/movements?warehouseId=` | `inventory.movements.search` |

- Filtrar por **una bodega o un artículo de otra empresa responde 404**, no una lista vacía.
- El listado de artículos devuelve los **nombres** de categoría, impuesto y unidades: se ve la tabla
  de artículos sin permiso para leer esos maestros del catálogo.
- Cuerpo de crear y editar:

```json
{
  "warehouseId": "…",
  "date": "2026-09-01",
  "notes": "Conteo inicial",
  "lines": [
    { "itemId": "…", "unitId": "…", "direction": "in", "quantity": 10, "unitCost": 12 },
    { "itemId": "…", "unitId": "…", "direction": "out", "quantity": 6 }
  ]
}
```

---

## 8. Pantallas

| Ruta | Qué hace |
|---|---|
| `/inventario` | Redirige a la primera sección que el rol puede ver |
| `/inventario/articulos` | Tabla con SKU, tipo, categoría, **para qué se usa** (comprar, vender), **impuestos de venta y de compra** y unidades («un · 1 cja = 24 un»); **buscador y paginación**; panel con código de barras, editor de unidades y **mínimos por bodega** |
| `/inventario/bajo-minimo` | Lo que hay que reponer: **existencia, reservado, en camino y proyectada**, mínimo, cuánto falta y cuánto pedir, con filtro por bodega |
| `/inventario/existencias` | Artículo, bodega, existencia en unidad base, costo promedio, valor y total; filtro por bodega en la dirección |
| `/inventario/ajustes` | Código, fecha, bodega, resumen de líneas («+2 cja (48 un) AGUA-500»), estado y Opciones según el estado |
| `/inventario/kardex` | Elige artículo y bodega; cada movimiento con documento, cantidad, costo, saldo y promedio, y las anulaciones marcadas |

- El formulario de artículos se ofrece solo si el rol puede leer categorías, impuestos y unidades.
- En el editor de unidades, **la primera unidad elegida queda como base**, y la marca sigue a la
  unidad si se cambia la de su fila.
- El formulario de ajustes se ofrece solo si el rol puede leer artículos y bodegas.
- En cada línea: al elegir un artículo se propone su unidad base; el costo solo se habilita en
  entradas.
- Confirmar y anular muestran el error traducido encima de la tabla («No hay existencia suficiente
  para esta salida.»).

---

## 9. Datos de demostración

**Artículos**: Acme — Agua mineral 500 ml (caja de 24, IVA al vender y al comprar), Detergente 1 kg (**IVA al vender,
exento al comprar**), Servicio de entrega (exento, solo se vende); Globex — Filtro de aceite.

**Mínimos**: los dos casos que hay que entender.

- **El agua** se vigila en Principal (mínimo 300, máximo 960, pedir 480) y hay 288, pero una orden de compra ya
  trae 144 y un pedido reserva 72: su proyectada es **360** y **no aparece** en Bajo mínimo. Pedirla otra vez
  sería comprar dos veces lo mismo.
- **El detergente** sí aparece: hay 50, un pedido reserva 10 y una orden trae 20, así que proyecta **60** contra
  un mínimo de 80. Faltan 20.

| Empresa | Ajuste | Estado | Contenido | Existencia resultante |
|---|---|---|---|---|
| Acme | `AJU000001` | Confirmado | 10 cajas de agua a 12; 50 kg de detergente a 3,20 | Agua 240 un a 0,50; detergente 50 kg a 3,20 (Principal) |
| Acme | `ENT000001` (compras) | Confirmada | 4 cajas de agua a 12 | Agua 336 un a 0,50: segundo movimiento de su kardex |
| Acme | `DES000001` (ventas) | Confirmado | Salen 2 cajas al promedio | Agua **288 un**: tercer movimiento |
| Globex | `DES000001` (ventas) | Confirmado | Salen 5 filtros a 8,50 | Filtro **25 un** |
| Acme | `AJU000002` | Borrador | Salida de 6 un de agua («Merma por rotura») | — |
| Globex | `AJU000001` | Confirmado | 30 filtros a 8,50 | Filtro 30 un (Central) |
| Globex | `AJU000002` | Borrador | Salida de 2 filtros | — |

Se rehace entero en cada corrida de semillas, junto con compras y ventas.

---

## 10. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Artículos | `contexts/inventory/{domain/item,application/*-item*}/**/*.spec.ts` | Cada regla del maestro, sin base de datos |
| Dominio | `contexts/inventory/domain/**/*.spec.ts` | Aritmética exacta, costo promedio, reversiones, «existencia = suma del kardex», ciclo del ajuste, fábrica de líneas |
| Aplicación | `adjustment-lifecycle.spec.ts` | Crear, editar, confirmar con catálogo de hoy, anular, consultar, aislamiento |
| Contrato | `inventory-ports.contract.ts` | 19 casos contra doble y PostgreSQL: atomicidad, 2 salidas simultáneas, doble confirmación, 12 ajustes concurrentes con la propiedad del kardex intacta |
| Contrato de artículos | `item-ports.contract.ts` | 15 casos contra doble y PostgreSQL: factores decimales, SKU único, lo que el artículo comprometió leído con su fila bloqueada, y categorías, impuestos y unidades sin cruzar empresas |
| API de artículos | `tests/api/items.api.spec.ts`, `item-protection.api.spec.ts` | Reglas por HTTP, 8 altas simultáneas con códigos distintos, permisos; unidades y estado protegidos con documentos abiertos, borradores con caja cambiada y carreras |
| API | `tests/api/inventory.api.spec.ts` | Todo lo anterior por HTTP, con un artículo propio por prueba |
| Interfaz de artículos | `tests/ui/items.spec.ts` | SKU repetido y los cuatro rechazos del maestro en español, en el panel; solo lectura |
| Interfaz | `tests/ui/inventory.spec.ts` | Recorrido ajuste → existencias → kardex → anulación; guarda en cero en español; solo lectura |
| Aislamiento | `tests/isolation/*` | 9 ataques: editar o desactivar artículos de Globex, crear uno con su unidad, editar, confirmar o anular sus ajustes, crear en su bodega, leer su kardex o filtrar por su bodega |
