# Revisión: Inventario › Artículos

**Fecha:** 14-sep-2026, cerrado el 18-sep-2026 · **Estado:** ✅ cerrado · **Piloto del método**
([README](../README.md))

El artículo es el maestro más referenciado del sistema: lo usan ajustes, kardex, existencias,
órdenes de compra, entradas, pedidos, despachos, facturas y reportes. Por eso sus reglas afectan a
casi todo lo demás.

---

## 1. Qué hace hoy el sistema

### 1.1 Datos

| Campo | Regla | Dónde |
|---|---|---|
| `code` | `ART000001`, lo asigna el sistema al crear y nunca cambia | `item.entity.ts:38`, `item-creator.ts:35` |
| `sku` | Obligatorio, hasta 60, **en mayúsculas**, solo `A-Z 0-9 . _ -`, único por empresa. **Editable siempre** | `sku.vo.ts:4-10`, `sku-uniqueness.ts`, índice `items_tenant_id_sku_key` |
| `name` | Obligatorio, hasta 200. **No es único** | `item-name.vo.ts` |
| `description` | Opcional, hasta 1000; vacío se guarda como nulo, más largo se **rechaza** | `bounded-text.vo.ts:23-35` |
| `type` | `inventoried` o `service` | `item-type.ts:5` |
| `category_id`, `tax_id` | Opcionales. Un solo impuesto para compra y venta | `item.entity.ts:19-20` |
| `item_units` | Al menos una, **exactamente una base con factor 1**, sin repetidas, factor > 0 con **4 decimales** | `item-units.ts:33-52`, `conversion-factor.vo.ts`, `CHECK item_units_base_factor_is_one` |
| `is_active` | Nada se borra: se desactiva y se reactiva | `item-status-changer.ts` |

### 1.2 Operaciones

| Operación | Ruta y permiso | Qué comprueba |
|---|---|---|
| Listar | `GET /api/v1/catalog/items` · `catalog.items.search` | Todos, activos e inactivos, por nombre y **sin paginar**. Devuelve los nombres de categoría, impuesto y unidades |
| Crear | `POST` · `catalog.items.create` | Valores válidos (400 sin consultar la base); categoría, impuesto y unidades de la empresa y **activos**; SKU libre; código con secuencia |
| Editar | `PUT /:itemId` · `catalog.items.update` | Lo mismo, pero **tolera conservar** una referencia que se desactivó después. Con movimientos de kardex **no cambia la unidad base ni el tipo** (`ItemWithMovementsError`, `item-updater.ts:35-37`) |
| Desactivar | `PUT /:itemId/status` · `catalog.items.deactivate` | **No con existencia > 0** (`ItemWithStockError`, `item-status-changer.ts:33-35`) |
| Reactivar | El mismo | Categoría, impuesto y unidades **activos** (`item-references.ts:48-65`) |

Las unidades se **reemplazan enteras** en cada guardado, dentro de una transacción
(`prisma-item.repository.ts:37-56`). Si dos altas con el mismo SKU pasan la comprobación a la vez,
el índice único responde 409.

### 1.3 Pantalla

`/catalogo/articulos`: tabla con artículo y SKU, tipo, categoría, impuesto y unidades
(«un · 1 cja = 24 un»), y panel lateral con editor de unidades. El formulario **solo aparece si el
rol puede leer categorías, impuestos y unidades** (`page.tsx:25-27`); la API no lo exige. El tipo
«Servicio» se ofrece sin ningún aviso.

### 1.4 Lo que otros módulos hacen con el artículo

| Módulo | Qué exige al usarlo | Dónde |
|---|---|---|
| Inventario (ajustes) | Activo, **no servicio**, la unidad es del artículo, cantidad base con el factor **de hoy** | `adjustment-line-factory.ts:58-67` |
| Compras (órdenes) | Activo, **no servicio**, impuesto copiado del artículo, factor **de hoy** | `purchase-order-references.ts:65-89` |
| Compras (entradas) | Activo, la unidad sigue en el artículo, cantidad base con el factor **de hoy** | `goods-receipt-line-factory.ts:51-58` |
| Compras (en camino) | Lo pendiente en base con el factor **de la orden** | `purchase-order-line.ts:100-101` |
| Ventas (pedidos) | Activo, **no servicio**, impuesto copiado, factor **de hoy** | `sales-order-references.ts:65-77` |
| Ventas (despachos) | Activo; cantidad base proporcional **a la del pedido** | `dispatch-line-factory.ts:50`, `baseOf` |
| Documentos y reportes | Muestran el SKU y el nombre **actuales** (las líneas no guardan copia) | `invoice-searcher.ts:79`, `prisma-reporting-read-model.ts:113` |
| Catálogo | Una categoría, un impuesto o una unidad **usados por un artículo activo** no se desactivan | `catalog-usage.ts` |
| Base de datos | Todas las líneas y el kardex apuntan al artículo con `ON DELETE RESTRICT` y FK compuesta con la empresa | migraciones de inventario, compras y ventas |

### 1.5 Pruebas que lo cubren

- **Unitarias:** SKU, tipo, unidades, entidad, referencias, unicidad, uso del catálogo, y los
  cuatro casos de uso (incluidos «con movimientos no cambia base ni tipo» y «con existencia no se
  desactiva»).
- **E2E API:** alta con caja de 24, SKU repetido escrito con otras mayúsculas, unidades sin base, códigos
  distintos en altas simultáneas, y en `inventory.api.spec.ts` existencia y cambio de base.
- **E2E UI:** alta completa, SKU repetido explicado en español, rol de solo lectura.
- **Aislamiento:** editar, cambiar estado y crear contra artículos de otra empresa.

No hay ninguna prueba que cambie o quite una unidad **secundaria** con documentos abiertos, ni que
use un servicio en un documento desde el catálogo.

---

## 2. Reglas del compañero

Fuente: [`docs/inventario.md` §1 y §1.1](https://github.com/verlumyx/erp/blob/main/docs/inventario.md),
[`docs/catalogo.md` §3](https://github.com/verlumyx/erp/blob/main/docs/catalogo.md),
[`docs/pendientes.md`](https://github.com/verlumyx/erp/blob/main/docs/pendientes.md),
[`docs/compras.md`](https://github.com/verlumyx/erp/blob/main/docs/compras.md) y
[`docs/ventas.md`](https://github.com/verlumyx/erp/blob/main/docs/ventas.md).

- `sku` obligatorio y único por empresa; `code` `ART` secuencial aparte. `barcode` único.
- Cuatro tipos: `inventoried`, `non_inventoried`, `service`, `serialized`. Los dos intermedios
  **se compran y se venden** sin mover existencia; un flete va como línea de servicio.
- Impuesto **de venta** y **de compra** por separado.
- Costos (`average_cost` solo lectura, `standard_cost`, método de costo), `min_price`, precios por
  lista, `is_purchasable` e `is_sellable`, mínimos, máximos y reorden, peso, volumen e imagen.
- **Unidades:** exactamente una base con factor 1; factor `decimal(18,8)`; **cambiar la base está
  bloqueado con movimientos**; **no se desactiva ni se quita una unidad usada en documentos
  abiertos**.
- **No se desactiva con existencia distinta de cero ni con documentos abiertos.** En
  `pendientes.md` precisa qué cuenta como abierto: pedidos de venta y órdenes de compra en
  `draft`, `confirmed` o `partial`.
- Una unidad usada **como base** por un artículo activo no se desactiva (nosotros también
  bloqueamos si se usa como secundaria).

---

## 3. Qué hace un ERP

- **Borrar no, inactivar sí.** SAP Business One no deja borrar un artículo usado en documentos o
  transacciones; se marca inactivo y ya no entra en pedidos ni órdenes
  ([SAP Community](https://community.sap.com/t5/enterprise-resource-planning-q-a/how-to-delete-item-master-record-with-transaction-data/qaq-p/545434),
  [SAP B1 Tips](https://www.sap-business-one-tips.com/en/set-items-to-inactive/)). Odoo archiva en
  vez de borrar ([Odoo forum](https://www.odoo.com/forum/help-1/how-do-i-solve-these-two-errors-when-deleting-an-a-product-259051)).
- **La unidad base no cambia con transacciones.** Business Central lo impide mientras haya
  movimientos abiertos, porque el libro de artículos guarda todo en la base
  ([mibuso](https://forum.mibuso.com/discussion/43592/changing-base-unit-of-measure)); ERPNext
  sugiere crear otro artículo ([issue #13079](https://github.com/frappe/erpnext/issues/13079)); Odoo
  igual ([Odoo forum](https://www.odoo.com/forum/help-1/change-uom-250016)).
- **El factor de una unidad en uso tampoco.** Business Central rechaza cambiar la «Qty. per Unit of
  Measure» si hay líneas de venta o compra abiertas con esa unidad, porque no podrían registrarse
  ([Dynamics Community](https://community.dynamics.com/blogs/post/?postid=c8fe9d94-cdf8-ee11-a73d-0022484f4b6d)).
- **El tipo (lleva stock o no) se congela con movimientos.** ERPNext bloquea cambiar «Maintain
  Stock» si hay transacciones ([ERPNext docs](https://docs.erpnext.com/docs/v13/user/manual/en/stock/articles/maintain-stock-field-frozen-in-item-master));
  Odoo tampoco lo cambia libremente ([Odoo 17](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/product_management/configure/type.html)).
- **Los servicios se compran y se venden**, solo que no pasan por bodega (Odoo, Business Central).
- **Bloqueos separados.** Business Central tiene «Blocked», «Sales Blocked» y «Purchasing Blocked»
  ([Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/business-central/inventory-how-block-items)).
- **El SKU debe ser único y durable** ([NetSuite](https://www.netsuite.com/portal/resource/articles/inventory-management/item-master-data.shtml),
  [Cleverence](https://www.cleverence.com/articles/for-business/what-is-sku-in-inventory-4829/)).

---

## 4. Matriz

| Regla | Sistema | Compañero | ERP | Veredicto |
|---|---|---|---|---|
| No se borra, se desactiva | Sí | Sí | Sí | Coincide |
| Código `ART` del sistema, inmutable | Sí | Sí | Sí | Coincide |
| SKU obligatorio y único por empresa | Sí, sin distinguir mayúsculas, con 409 en carrera | Sí | Sí | Coincide |
| SKU editable con documentos | Sí; los documentos muestran el nuevo | Sin regla | Durable | Difiere con motivo (ver H7) |
| Una sola base con factor 1 | Dominio + `CHECK` del factor; **ningún índice impide dos bases** en la base de datos | Dominio | Sí | Coincide (ver H8) |
| Base no cambia con movimientos | Sí | Sí | Sí | Coincide |
| Tipo no cambia con movimientos | Sí | Implícito | Sí | Coincide |
| **Factor de una unidad secundaria en uso** | **Se cambia libremente** | No se quita con documentos abiertos | No con líneas abiertas | **Hueco (H1)** |
| **Quitar una unidad secundaria en uso** | **Se permite** | Bloqueado | Bloqueado | **Hueco (H1)** |
| No desactivar con existencia | Sí | Sí | Sí | Coincide |
| **No desactivar con documentos abiertos** | **No se comprueba** (anotado en `FUTURE.md`) | Bloqueado | Inactivar avisa o impide | **Hueco (H2)** |
| Reactivar exige referencias activas | Sí | Sin regla | — | Sobra, pero con sentido: evita volver a ofrecer algo inactivo |
| Editar conserva referencias inactivas | Sí | Sin regla | — | Coincide con el criterio común |
| **Servicio se compra y se vende** | **Documentado y ofrecido, pero rechazado en todo documento** | Sí | Sí | **Hueco (H3)** |
| Precisión del factor | 4 decimales | 8 decimales | Configurable | Difiere (H4) |
| Impuesto de venta y de compra | Uno solo | Dos | Separados | Difiere con motivo (H5) |
| Costos, precios, mínimo, código de barras, comprable/vendible, reorden, lotes, series, no inventariado | No | Sí | Sí | Difiere con motivo: alcance (H6) |
| Listado paginado | No | Select remoto paginado | Sí | Difiere con motivo: ya en `FUTURE.md` |

---

## 5. Hallazgos

### H1 · ALTA · Cambiar o quitar una unidad secundaria con órdenes abiertas descuadra o traba la compra

**Qué pasa.** Editar un artículo solo protege la base y el tipo (`item-updater.ts:35`). El factor de
la caja se puede cambiar, y la caja se puede quitar, aunque una orden confirmada la use. La entrada
calcula la cantidad base con el factor **de hoy** (`goods-receipt-line-factory.ts:58`), pero «en
camino» descuenta con el factor **de la orden** (`purchase-order-line.ts:100-101`).

**Reproducido contra la API local** (14-sep-2026):

| Paso | Resultado |
|---|---|
| Orden confirmada de 10 cajas de 24 | En camino: **240** |
| Editar el artículo: caja de 24 → 12 | **200**, sin aviso |
| Recibir las 10 cajas | Existencia **+120**; en camino **0** |
| — | **120 unidades anunciadas desaparecen** sin que nadie lo vea |
| Otra orden de 5 cajas; quitar la caja del artículo | **200** |
| Recibir las 5 cajas | **400 `PurchaseUnitNotOfItemError`**; en camino se queda colgado en 120 |

Ventas no tiene el problema al despachar (usa la base del pedido), así que **compras y ventas
aplican políticas distintas** para lo mismo.

**Opciones.**
1. **Bloquear** cambiar el factor o quitar una unidad usada en documentos abiertos: ajustes en
   borrador, órdenes y pedidos en borrador, confirmados o parciales, y entradas y despachos en
   borrador. Es lo que hacen el compañero y Business Central.
2. **Congelar el factor en la orden:** la entrada usa la base proporcional de la orden, como ya
   hace el despacho. No descuadra, pero quitar la unidad seguiría trabando la entrada.
3. **Las dos:** bloquear en el catálogo y alinear la entrada con el despacho.

**Recomendación:** la 3. La 1 cierra el hueco en el origen, y la 2 deja a compras y ventas con la
misma regla aunque la protección del catálogo fallara.

### H2 · MEDIA · Se desactiva un artículo con documentos abiertos y el ciclo queda trabado

**Qué pasa.** Solo se mira la existencia (`item-status-changer.ts:33`). Reproducido: con una orden
confirmada de 2 cajas y sin existencia, desactivar responde 200 y la entrada falla con
`409 InactivePurchaseItemError`. Por el código, en ventas pasaría lo mismo (no reproducido): un ajuste deja la existencia en cero
con un pedido reservado, el artículo se desactiva y el despacho falla.

Ya está anotado en `docs/FUTURE.md` («Proteger en el catálogo lo que tiene órdenes abiertas»), y el
error es claro. Por eso es media y no alta: no corrompe datos, pero obliga a reactivar para
terminar.

**Opciones.**
1. **Bloquear** con documentos abiertos, con la definición del compañero: órdenes y pedidos en
   `draft`, `confirmed` o `partial`.
2. Bloquear solo lo **confirmado o parcial**; los borradores fallarían al confirmar, que ya pasa hoy.
3. **Avisar** qué documentos quedan afectados y dejar desactivar.

**Recomendación:** la 2. Un borrador todavía no promete nada a nadie, y el sistema ya lo revalida
al confirmar.

### H3 · MEDIA · Se puede crear un servicio que ningún documento acepta

**Qué pasa.** `docs/modulos/catalogo.md:117` y el comentario de `item-type.ts:3-4` dicen que un
servicio «se compra y se vende», y la pantalla lo ofrece. Pero compras
(`ServiceNotPurchasableError`), ventas (`ServiceNotSellableError`) y ajustes
(`ServiceHasNoStockError`) lo rechazan. Reproducido: el servicio se crea (201) y la orden con él
responde 400. `FUTURE.md` sí anota «Comprar servicios» y «Vender servicios» como pendientes, así
que la contradicción está entre la documentación del catálogo y el comportamiento real.

**Opciones.**
1. **Corregir la documentación y el comentario**, y en la pantalla explicar que por ahora un
   servicio no se usa en documentos.
2. **Quitar el tipo** hasta que compras y ventas lo acepten.
3. **Implementar** servicios en órdenes, pedidos y facturas, sin bodega ni reserva.

**Recomendación:** la 1 ahora; la 3 cuando se retome el alcance de ventas y compras.

### H4 · BAJA · El factor admite solo 4 decimales

Con una base mayor que la unidad pequeña (base «docena», unidad «pieza» = 0,0833), 12 piezas
suman 0,9996 docenas. El compañero guarda 8 decimales y Business Central ofrece precisión de
redondeo configurable. Casi siempre la base es la unidad más pequeña y el factor es entero, así que
el caso es raro.

**Opciones:** documentar que la base debe ser la unidad más pequeña, o ampliar a `decimal(18,8)`.
**Recomendación:** documentarlo.

### H5 · BAJA · Un solo impuesto para comprar y vender

Compañero y ERP los separan: un artículo puede comprarse exento y venderse con IVA. Hoy la orden y
el pedido copian el mismo. **Recomendación:** dejarlo como decisión de alcance y anotarlo en
`FUTURE.md`.

### H6 · BAJA · Campos de un maestro completo que no existen

Código de barras, costo estándar y método de costo, precio mínimo y precios por lista, comprable y
vendible, mínimo, máximo y reorden, peso, volumen, imagen, lotes, series y tipo no inventariado.
`FUTURE.md` ya recoge listas de precio, lotes y series. **Recomendación:** añadir a `FUTURE.md` el
código de barras, comprable/vendible y reorden, que son los que un ERP pequeño echa en falta
primero. El compañero propone `min_price`, pero sin listas de precio no tiene contra qué validar.

### H7 · BAJA · Cambiar el SKU o el nombre cambia lo que muestran los documentos ya emitidos

Las líneas guardan precio, impuesto y cantidades, pero **no** el SKU ni el nombre. Una factura
vieja se ve (y se exporta) con el nombre de hoy. **Opciones:** documentarlo, o copiar SKU y nombre en las líneas al confirmar.
**Recomendación:** documentarlo ahora y decidir la copia al revisar Facturas.

### H8 · BAJA · La base de datos permite dos unidades base

El `CHECK` exige factor 1 a la base, pero ningún índice único parcial impide dos bases en un mismo
artículo. Hoy solo lo protege el dominio. **Recomendación:** añadir el índice
`UNIQUE (item_id) WHERE is_base`, como ya se hizo con la bodega por defecto.

### H9 · BAJA · Posible carrera al desactivar o cambiar la base (no reproducida)

Desactivar mira la existencia y luego guarda, y editar mira los movimientos y luego guarda, sin
bloquear el artículo. Una entrada o un ajuste confirmados en ese mismo instante podrían dejar un
artículo inactivo con existencia, o con la base cambiada justo después de su primer movimiento.
**No se reprodujo**; es una ventana de milisegundos. **Recomendación:** anotarla y revisarla junto
con la concurrencia de Inventario.

---

## 6. Segunda opinión (agy · Gemini 3.1 Pro)

Hizo la misma revisión por su cuenta, sin ver esta.

- **Coincide** en la matriz de base, tipo, factor 1, existencia y no borrado, y en H2.
- **Puso H2 como alta** y afirmó que Dynamics 365 impide inactivar con órdenes abiertas, **sin dar
  fuente**. Lo verificable de Business Central son los bloqueos por venta y compra, no esa regla.
  Se deja en media por lo explicado arriba.
- **Propuso `min_price` como hueco medio.** Descartado como defecto: sin listas de precio no hay
  contra qué validar; queda en H6 como alcance.
- **Dijo que la descripción se trunca a 1000.** Es falso: se rechaza con `TextTooLongError`.
- **No encontró H1 ni H3**, que son los dos hallazgos que cambian comportamiento real.

---

## 7. Decisiones de Rafael

**14-sep-2026.** Se atacan **todos** los hallazgos antes de pasar al siguiente submódulo: «es mejor
tener un módulo 100 % funcional a tener muchos módulos y que estén a medias».

| Tema | Decisión |
|---|---|
| H1, H2, H8, H9 | Se corrigen |
| H3 | Se corrige la documentación y la pantalla; comprar y vender servicios se investiga en Compras y Facturas |
| H4, H5, H7 | Se corrigen |
| H6 | Código de barras, comprable/vendible y reorden se agregan. No inventariado, lotes, series y método de costo se investigan en Inventario. La imagen espera al módulo de adjuntos |
| Listado paginado | Se corrige |
| Ubicación | Artículos pasa a **Inventario**: código, pantalla y permisos, siguiendo a los ERP |
| Listas de precio | Se hacen **ahora**; su ubicación se investiga antes |
| Configuración de la empresa | Se hace; qué lleva se investiga antes |

El orden de ataque y los temas por investigar están en el [checklist](../README.md#temas-por-investigar-y-ubicar).

---

## 8. Correcciones

### Fase 1 · Integridad (H1, H2, H8, H9)

| Hallazgo | Qué cambió | Dónde se prueba |
|---|---|---|
| H8 | Índice único parcial `item_units_one_base_per_item`: la base de datos rechaza una segunda unidad base | `item-units-base.integration.spec.ts` |
| H1 | Editar el artículo no quita ni cambia el factor de una unidad que usan órdenes o pedidos confirmados con pendiente, ni cambia su tipo (`ItemUnitInOpenDocumentsError`, `ItemInOpenDocumentsError`). La entrada toma la base proporcional de la orden, como ya hacía el despacho | `item-commitments.spec.ts`, `item-updater.spec.ts`, `purchase-cycle.spec.ts`, contrato del catálogo, e2e `item-protection.api.spec.ts` |
| H2 | Desactivar el artículo exige que no lo usen órdenes ni pedidos confirmados con pendiente; los borradores no cuentan | `item-status-changer.spec.ts`, contrato del catálogo, e2e con mercancía en camino y con una reserva sobre existencia en cero |
| H9 | Editar y desactivar bloquean la fila del artículo y leen lo comprometido dentro de la misma transacción. Confirmar un ajuste, una orden, un pedido o una entrada, o mover existencia, bloquea sus artículos en modo compartido y comprueba que sigan activos, inventariados y con el mismo factor (`StockItemChangedError`, `PurchaseItemChangedError`, `SalesItemChangedError`) | Contratos de inventario, compras y ventas; e2e con dos carreras repetidas cinco veces |

**Lo que apareció al corregir:**

- **La pantalla de artículos explicaba mal sus propios rechazos.** El traductor del catálogo no
  conocía `ItemWithStockError` ni `ItemWithMovementsError`, y un 409 se leía como «Ese dato ya
  existe». Ahora los cuatro errores del artículo tienen su mensaje.
- **Anular un documento podía devolver existencia a un artículo inactivo** (por ejemplo, anular un
  despacho o un ajuste de salida después de desactivarlo). Ahora ningún movimiento, tampoco una
  anulación, toca un artículo inactivo o un servicio: primero se reactiva.
- `FUTURE.md` ya no pide proteger el artículo con órdenes abiertas; queda la bodega, que se revisa en
  Bodegas.

**Verificación:** tipos de API, web y e2e; lint; 2162 pruebas unitarias de la API y 152 de la web;
139 casos de contrato contra PostgreSQL; 306 pruebas e2e, entre ellas las 6 nuevas de
`item-protection.api.spec.ts`.

### Fase 2 · Artículos en Inventario

Rafael decidió que Artículos va bajo Inventario, como en SAP Business One, Odoo y Business Central, y
que se mueve también el código. Categorías, unidades, impuestos y bodegas siguen en el catálogo.

| Qué | Cómo quedó | Dónde se prueba |
|---|---|---|
| Código | Dominio, casos de uso, HTTP y persistencia del artículo en `contexts/inventory`. El código `ART` sale del contador del inventario. Los errores conservan su nombre: la web traduce por nombre | Pruebas de dominio y aplicación movidas; `error-categories.spec.ts` del inventario |
| Frontera con el catálogo | Inventario pregunta por categorías, impuestos y unidades con el puerto `CatalogReferences`; el catálogo pregunta si un artículo activo usa algo con `ItemUsage`. Ninguno importa código del otro: los adaptadores leen las tablas ajenas | Contrato nuevo `item-ports.contract.ts` (15 casos) y contrato del catálogo con `ItemUsage` |
| API y permisos | `api/v1/inventory/items` y `inventory.items.*`. Una migración crea los códigos nuevos, copia cada concesión y borra los viejos: ningún rol pierde acceso | Sincronización sin permisos huérfanos; matriz de aislamiento con las tres rutas nuevas |
| Pantalla | `/inventario/articulos`, primera sección de Inventario. Órdenes, pedidos, ajustes y kardex cargan los artículos desde la API nueva | `inventory-sections.spec.ts`, e2e de catálogo e inventario |
| Hueco de 9.3 | La pantalla ve en el panel el SKU repetido y los cuatro rechazos del artículo: existencia, movimientos, unidad usada por una orden abierta y artículo con órdenes abiertas | `tests/ui/items.spec.ts` |

**Decisiones de construcción** (anotadas también en el pendiente de revisión):

- El puerto `InventoryCatalog`, que usan los ajustes, conserva su nombre: ahora lee artículos del propio
  contexto, pero un ajuste no necesita el agregado. Renombrarlo tocaba ajustes, existencias y contratos
  sin cambiar comportamiento.
- Las bodegas no se movieron: su lugar se decide en la revisión de Bodegas.

**Segunda opinión:** `agy` respondió «CONCUR — sin hallazgos» sin detallar nada. Con un diff de 321 KB
se toma como indicio débil, no como verificación; la verificación es la suite.

**Verificación:** tipos de API, web y e2e; lint; 2190 pruebas unitarias de la API y 154 de la web; 142
casos de contrato contra PostgreSQL; 315 pruebas e2e contra el sistema reconstruido.

---

## 9. Segunda pasada del método (después de la fase 1)

**Fecha:** 14-sep-2026. Mismo método sobre el código corregido: lectura del código, reproducción contra
la API reconstruida, contraste con el compañero y los ERP, y segunda opinión adversarial de `agy`.

### 9.1 Reproducción contra la API

Script `repro-articulos-2.mjs` (fuera del repositorio): **19 de 19 comprobaciones como se esperaba.**

| Caso | Resultado |
|---|---|
| Cambiar la caja 24 → 12, quitarla o volver servicio el artículo con una orden confirmada | 409 `ItemUnitInOpenDocumentsError` / `ItemInOpenDocumentsError` |
| Renombrar con la orden confirmada | 200 (lo legítimo sigue permitido) |
| Recibir las 10 cajas | Entran **240**; recibida la orden, la caja ya se puede cambiar |
| Desactivar con mercancía en camino; anulada la orden | 409 `ItemInOpenDocumentsError`; después 200 |
| Una orden en **borrador** no impide desactivar; ese borrador ya no se confirma | 200; 409 `InactivePurchaseItemError` |
| Desactivar con un pedido que reserva y la existencia en cero | 409 `ItemInOpenDocumentsError` |
| Anular un ajuste de salida de un artículo ya inactivo | 409 `InactiveStockItemError`; la existencia sigue en 0 |
| Confirmar una entrada y desactivar a la vez, 8 veces | Nunca pasan las dos; ningún 500 |
| 36 operaciones simultáneas: ajustes con dos artículos en órdenes cruzadas, renombres y guardados de unidades | Ningún 500 ni interbloqueo; todo lo legítimo pasa; existencia 88 y 88 como corresponde |

### 9.2 Matriz, lo que cambió

| Regla | Antes | Ahora | Veredicto |
|---|---|---|---|
| Factor de una unidad en uso | Se cambiaba | Bloqueado con órdenes o pedidos abiertos | Coincide (compañero, Business Central) |
| Quitar una unidad en uso | Se permitía | Bloqueado | Coincide |
| Desactivar con documentos abiertos | No se comprobaba | Bloqueado | Coincide, **salvo borradores**: el compañero los cuenta, nosotros no (pendiente 22) |
| Una sola base en la base de datos | Solo el dominio | Índice único parcial | Coincide |
| Entrada con la base de la orden | Factor de hoy | Base de la orden, igual que el despacho | Coincide con ventas |
| Movimientos de un artículo inactivo | Una anulación podía devolverle existencia | Rechazado siempre | Más estricto que Business Central, que deja devolver lo bloqueado; con motivo: aquí inactivo significa sin existencia |
| Desactivar una unidad del artículo | — | No existe: las unidades se reemplazan enteras | Difiere con motivo (el compañero les da estado propio) |

### 9.3 Lo que sigue abierto

| Hallazgo | Estado | Fase |
|---|---|---|
| H3 · Servicios | Se crea (201) y la orden lo rechaza (400): sin cambios | 6 (documentación y pantalla) |
| H4 · Factor con 4 decimales | 0,08333 se rechaza con `InvalidConversionFactorError` | 4 |
| H5, H6, H7, paginación | Sin cambios | 4 |
| Artículos en Inventario, configuración y listas de precio | Sin empezar | 2, 3 y 5 |
| **Nuevo · Pantalla sin prueba de los mensajes nuevos** | Los cuatro mensajes del artículo están probados en el traductor de la web, pero ninguna prueba de interfaz los ve en el panel | Baja; se cubre en la fase 2, al mover la pantalla |
| **Bodega con órdenes abiertas** | Sigue sin protegerse | Revisión de Bodegas |

### 9.4 Segunda opinión adversarial (agy · Gemini 3.1 Pro)

Se le pidió romper lo corregido, con el diff completo adjunto. El primer intento se cortó a los cinco
minutos sin respuesta; el segundo, con más margen, devolvió cinco puntos. Cada uno se contrastó con el
código o con la API antes de aceptarlo:

| Punto de agy | Verificación | Veredicto |
|---|---|---|
| Interbloqueos: el orden documento → artículos → existencias no forma ciclos | Coincide con la prueba de estrés de 9.1 | **Confirmado** |
| «Regresión: ya no se pueden comprar ni vender servicios» | Ya se rechazaban antes de la fase 1 (`purchase-order-references.ts:67` y `sales-order-references.ts:67` en el último commit). Es H3, no una regresión | Descartado como regresión |
| «Un servicio usado nunca se podría desactivar», porque su orden no se recibe | Hoy no aplica: un servicio no entra en órdenes. Es cierto para cuando se implementen servicios en documentos: la consulta de documentos abiertos tendrá que ignorar sus líneas | **Anotado para H3** |
| «Un artículo con existencia negativa se desactiva», porque se mira `quantity > 0` | La base impide existencia negativa (`item_stocks_quantity_not_negative`); no existe la opción de permitirla | Descartado |
| «Un ajuste en borrador falla con 409 si cambian la caja antes de confirmarlo» | Reproducido: el borrador de 1 caja de 24 se confirma con **200** y entra **12**, porque al confirmar se revalida con el factor de hoy | Descartado el error; queda una pregunta de negocio (abajo) |

**Pregunta que deja el último punto.** Un conteo anotado como «1 caja» cuando la caja traía 24 entra como
12 si alguien cambia la caja antes de confirmarlo. Es la regla de revalidar borradores con el catálogo de
hoy, ya documentada, y la misma que tu compañero aplica a los borradores. La alternativa sería contar los
ajustes en borrador como documentos abiertos, lo que se une a la decisión del pendiente 22.

### 9.5 Conclusión

La fase 1 hace lo que dice: 19 de 19 comprobaciones, sin 500 ni interbloqueos bajo carga, y ninguna de las
objeciones de agy se sostiene como defecto del código actual. Lo que queda abierto es lo planificado para
las fases 2 a 6 y la bodega con órdenes abiertas.

**Decisiones de Rafael tras la segunda pasada (15-sep-2026):**

- **Borradores:** no cuentan como documento abierto, pero un ajuste, una orden o un pedido cuya caja cambió
  desde que se escribió **no se confirma en silencio**: responde 409 y pide revisarlo y guardarlo. Cierra la
  pregunta del conteo «1 caja» que entraba como 12. Hecho, con pruebas de aplicación en inventario, compras
  y ventas y una e2e.
- **Servicios:** se resuelven al implementarlos, con la regla del compañero: una línea de servicio no cuenta
  para el estado de recibido o despachado de su orden.

---

## 10. Cierre del piloto (18-sep-2026)

Las seis fases están hechas y subidas, cada una con su tema investigado antes de construir, sus
pruebas y su documentación de módulo. `make verify` en verde: **2640 + 174 unitarias, 176 de
contrato y 374 end-to-end**.

### 10.1 Qué se hizo en cada fase

| Fase | Qué cerró | Dónde quedó documentado |
|---|---|---|
| **1 · Integridad** | H1, H2, H8, H9: unidades y bajas con documentos abiertos, dos bases en la misma fila, carreras | §8 y §9 de este informe |
| **2 · Artículos en Inventario** | El maestro deja el Catálogo: código, pantalla, permisos y rutas | §8 |
| **3 · Configuración de la empresa y multimoneda** | Datos y parámetros de la empresa, tasas de cambio, compras, ventas, cobranza y reportes con moneda | [temas/configuracion-empresa.md](../temas/configuracion-empresa.md) · [modulos/empresa.md](../../modulos/empresa.md) |
| **4 · Artículo completo** | H4 (factor a 8 decimales), H5 (dos impuestos), H6 (código de barras, se compra / se vende, mínimos por bodega), H7 (SKU y nombre copiados en todos los documentos), listado paginado | [modulos/inventario.md §1](../../modulos/inventario.md#1-artículos) |
| **5 · Listas de precio** | El precio de venta deja de teclearse: listas en Catálogo, precios por artículo, resolución por unidad y moneda, precio mínimo | [temas/listas-de-precio.md](../temas/listas-de-precio.md) · [modulos/ventas.md §2.4](../../modulos/ventas.md#24-el-precio-de-una-línea) |
| **6 · Servicios** | H3: un servicio se compra y se vende sin dejar el documento abierto, y llega a la factura | [temas/servicios.md](../temas/servicios.md) · [modulos/ventas.md §2.5](../../modulos/ventas.md#25-servicios) |

### 10.2 Los nueve hallazgos, uno por uno

| Hallazgo | Estado |
|---|---|
| H1 · Unidad secundaria con órdenes abiertas | ✅ Corregido (fase 1). Cambiar o quitar una unidad que un documento abierto usa responde 409 |
| H2 · Baja con documentos abiertos | ✅ Corregido (fase 1) |
| H3 · Servicio que ningún documento acepta | ✅ Corregido (fase 6). Se compra, se vende, no se despacha ni se recibe, y se factura |
| H4 · Factor con 4 decimales | ✅ Corregido (fase 4). Ocho decimales: una docena da 0,08333333 por pieza y doce piezas suman 1 |
| H5 · Un solo impuesto | ✅ Corregido (fase 4). `sales_tax_id` y `purchase_tax_id` |
| H6 · Campos de un maestro completo | ✅ En parte, y a propósito: código de barras, se compra / se vende, mínimos por bodega y precios, hechos. No inventariado, lotes, series, método de costo, peso, volumen e imagen quedan **anotados en [FUTURE.md](../../FUTURE.md)** con su porqué |
| H7 · Cambiar el SKU cambia los documentos emitidos | ✅ Corregido (fase 4). Cada línea copia SKU y nombre |
| H8 · Dos unidades base en la base de datos | ✅ Corregido (fase 1). Índice único parcial |
| H9 · Carrera al desactivar o cambiar la base | ✅ Corregido (fase 1). Bloqueo del artículo antes de leer sus compromisos |

### 10.3 Lo que este piloto enseñó sobre el método

Lo que se lleva la skill, con el caso que lo demostró:

1. **Investigar antes de construir, y escribir el tema antes de tocar código.** Cada fase empezó por
   un documento en `revision/temas/` con las tres fuentes citadas. En listas de precio, eso cambió el
   diseño: la moneda pasó a la cabecera de la lista, que es lo que hacen los cuatro ERP y no lo que
   hace el compañero.
2. **Verificar cada hallazgo contra el código antes de aceptarlo.** En la revalidación de la fase 3,
   cuatro de cinco objeciones de `agy` no se sostuvieron. En la fase 5, los tres hallazgos sobre el
   compañero **sí** se sostuvieron, y solo se supo leyendo su código, no su documentación: su propio
   ERP no multiplica el precio por el factor de la unidad, y compara el precio mínimo sin convertir
   la moneda.
3. **Cuando las fuentes se contradicen, decide Rafael, y queda escrito por qué.** El precio mínimo es
   el caso: el compañero tiene un número fijo, los ERP controlan el margen sobre el costo. Se eligió
   el número fijo, y el porqué del descarte está en el tema.
4. **Atacar todos los hallazgos; lo que no se construye se anota.** `FUTURE.md` creció con la
   vigencia de precios, el precio por unidad, el margen sobre el costo, las listas de compra y los
   tipos de artículo que faltan — cada uno con qué es, por qué y qué haría falta.
5. **La prueba de interfaz en paralelo encuentra lo que la aislada no.** La pantalla de facturas
   reventaba en cuanto existía una factura sin despacho; aislada pasaba.
6. **Un campo que pasa a ser nulo hay que perseguirlo por toda la interfaz**, no solo por la API.
7. **Verificar a mano contra la API local**, además de las pruebas: fue lo que confirmó que 0,85 por
   pieza da 20,40 la caja, y que el mismo precio en euros da 0,743416 por el bolívar.

### 10.4 Qué queda abierto

- **La tasa de fines de semana y feriados**, decisión de Rafael que no bloquea nada
  ([configuracion-empresa.md §10.3](../temas/configuracion-empresa.md#103-decisiones-pendientes-de-rafael)).
- **Todo lo anotado en `FUTURE.md`** para este submódulo, que es deuda consciente, no olvido.

---

## 11. Revisión exhaustiva de las seis fases (18-sep-2026)

Dos revisiones en paralelo sobre lo construido —una adversarial del código, otra de cobertura de
pruebas— más comprobaciones propias. **Cada hallazgo se reprodujo antes de aceptarlo**, escribiendo
la prueba que lo dispara.

### 11.1 Lo que estaba bien

| Comprobado | Resultado |
|---|---|
| 18 reglas de negocio de las fases 5 y 6 | 17 ya tenían prueba que fallaría si se borrara la regla |
| Dos líneas del mismo servicio en un pedido | Cada una se factura por su cuenta; prueba añadida |
| División por cero al convertir un precio | Imposible: `RateValue` rechaza cero o menos en origen |
| Orden de bloqueos al emitir y al anular | Sin ciclo: despacho o factura siempre antes que el pedido |
| Límite de crédito con servicios arrastrados | Se compara el total real de la factura, servicios incluidos |

### 11.2 Los cinco defectos encontrados, todos corregidos

| # | Defecto | Por qué importaba | Corrección |
|---|---|---|---|
| **1** | **Se podía facturar un pedido en borrador**, y como el borrador sigue editándose, editarlo rehacía las líneas con identificadores nuevos y **se podía volver a facturar: doble cobro** | El peor de los cinco. Nació al abrir la vía «facturar sin despacho»: esa rama no comprobaba el estado del pedido | `SalesOrder.isInvoiceable()`; facturar un borrador responde `SalesOrderNotInvoiceableError`. Y una clave ajena de `invoice_lines` a la línea del pedido impide que una factura quede apuntando a una línea borrada |
| **2** | **Las facturas anteriores a la migración no se podían anular**: `invoiced_quantity` nació en cero aunque la línea ya estuviera facturada, y restar de cero revienta. Además el enlace `order_line_id` se rellenó cruzando artículo y unidad, y con dos líneas iguales elegía una al azar | Solo se ve en una base con datos previos, que es justo donde más duele | Migración `20261002000000`: el enlace se recalcula por **posición** contra las líneas del despacho (exacto, sin ambigüedad) y `invoiced_quantity` se recalcula desde las facturas emitidas |
| **3** | **Un pedido de solo servicios confirmado no se podía anular nunca**: nace «despachado», y anular rechazaba ese estado | Un pedido creado por error quedaba vivo para siempre | Anular ya no mira el estado sino los hechos: lo que se despachó y lo que se facturó. Un pedido facturado tampoco se anula (`SalesOrderWithInvoicesError`) |
| **4** | **Desactivar una lista dejaba sin comprar a sus clientes**: cualquier pedido de un cliente con esa lista se rechazaba, incluso con el precio escrito a mano | Desactivar una lista es una acción normal de mantenimiento, no debería paralizar clientes | La lista **del cliente** desactivada se ignora y se cae a la de por defecto; la que **elige una persona** en el pedido sí se rechaza, porque acaba de elegirla |
| **5** | **La pantalla sugería precios con más decimales de los que la empresa admite**: con `price_decimals = 2`, un factor de 12,5 sobre 0,85 proponía 10,625 y la API rechazaba el pedido | El usuario veía un precio que el sistema le rechazaba sin haberlo tocado | `suggestedPrice` redondea a los decimales de la empresa, como hace el servidor |

Los tres primeros los introdujo la fase 6, y los dos primeros solo existían en la vía nueva de
facturar sin despacho: **abrir un camino alternativo a un documento exige repasar todas las reglas
que el camino viejo daba por hechas**. Eso se lleva la skill.

### 11.3 Revisión de la interfaz a mano (18-sep-2026)

Rafael inició sesión y se recorrieron las pantallas nuevas en el navegador. **Lo que funciona tal
como se diseñó:** la lista de precios con su moneda y su marca de por defecto; la moneda que
desaparece al editar una lista; el editor de precios del artículo; el precio que se rellena solo al
elegir el artículo (0,85), cambia a 20,40 al vender en cajas y a 16,80 al cambiar a la lista
mayorista; el precio pactado a mano que sobrevive al cambio de lista; el aviso de que se convertirá
con la tasa del día; el servicio que ya se puede elegir en el pedido y nace despachado; y la factura
sin despacho, que muestra un guion en su columna.

**Cinco detalles encontrados y corregidos:**

| # | Detalle | Corrección |
|---|---|---|
| 1 | **Cambiar la moneda del pedido dejaba el precio pactado con el mismo número**, que pasaba a significar otra cosa: 15 dólares se convertían en 15 euros sin avisar | Cambiar de lista respeta el precio pactado; cambiar de **moneda** vuelve a cotizarlo todo, y si no se puede sugerir, el campo queda en blanco para que la persona diga cuánto vale |
| 2 | **Un pedido de solo servicios confirmado no ofrecía «Anular»** en la pantalla, aunque el dominio ya lo permitía tras el arreglo del §11.2 | La pantalla decide como el servidor: por los hechos (lo despachado y lo facturado), no por el estado |
| 3 | **El listado de artículos no mostraba los precios** ni el mínimo: se podían cargar y no se veían | Columna «Precios»: «Detal 0,85 · Mayorista 0,7 (min. 0,50)» |
| 4 | El subtítulo del Catálogo no nombraba las listas de precio | Corregido |
| 5 | El texto de Facturas decía que cobran lo que salió en un despacho, y ya no es solo eso | Corregido: «más los servicios del pedido, que no salen de ninguna bodega» |

El primero solo se ve usando la pantalla: ninguna prueba lo habría encontrado, porque el servidor
recibía exactamente lo que el formulario mandaba. **Recorrer la interfaz a mano sigue siendo parte
del método**, no un extra.

**Estado: ✅ cerrado y revisado.** El siguiente paso es escribir el método como skill reutilizable.

---

## 12. Revisión de la fase 4 (18-sep-2026)

La fase 4 —artículo completo— se construyó y se cerró **sin revisión adversarial propia**. Las
fases 5 y 6, al mirarlas de nuevo, soltaron diez cosas; suponer que la 4 estaba limpia porque las
pruebas pasaban habría sido ingenuo. Es también la primera revisión hecha **con la skill
`module-review`** que salió de este piloto.

Alcance: las seis piezas de la fase 4 —factor de ocho decimales, dos impuestos, código de barras y
banderas de compra y venta, SKU y nombre copiados en las líneas, listado paginado y mínimos por
bodega.

### 12.1 Lo que estaba bien

Se verificó y **no** se tocó:

- **Los dos impuestos**: compras lee `purchase_tax_id` y ventas `sales_tax_id`, sin un solo cruce.
  Sin impuesto se asume 0 %, no se rechaza la línea. `ItemUsage` mira los dos campos, así que un
  impuesto que solo se usa para comprar tampoco se puede liberar. La migración copió el `tax_id`
  viejo a ambas columnas.
- **La copia del SKU y el nombre**: las seis tablas de línea la escriben, y cada documento hijo
  copia **de la línea de origen**, nunca del maestro. La factura directa desde el pedido —el camino
  que abrió la fase 6— también copia.
- **El código de barras**: varios artículos pueden no tener ninguno, porque en la base un nulo no
  choca con otro nulo.

**Una objeción descartada tras comprobarla:** el informe de ventas por artículo lee el nombre del
maestro en vez de la copia de la línea. Es correcto: agrupa **por artículo**, no reproduce un
documento. La factura sigue mostrando el nombre con que se emitió.

### 12.2 Los seis hallazgos

| # | Gravedad | Qué | Cómo se encontró |
|---|---|---|---|
| 1 | **Alta** | **El factor de ocho decimales no llegaba al cálculo.** `Quantity.times()` hacía `Math.round(factor * 10_000)` en los tres contextos: recortaba el factor a **cuatro** decimales antes de multiplicar | Leyendo el código y reproduciéndolo contra la API |
| 2 | **Alta** | **La paginación escondía artículos.** Orden por nombre sin desempate, y el nombre no es único | Reproducido: cinco homónimos, uno nunca aparecía |
| 3 | Media | **Quitar «se vende» o «se compra» no miraba los documentos abiertos**, al contrario que desactivar | Leyendo `ensureCanChange` |
| 4 | Media | **El choque de código de barras no se traducía**: en carrera salía el error crudo del motor, no un 409 | Leyendo el repositorio |
| 5 | Decisión | **El bajo mínimo comparaba contra la existencia física**, ignorando lo reservado y lo que ya viene en camino | Comparando con ERPNext y Odoo |
| 6 | Baja | El bajo mínimo listaba **bodegas desactivadas y servicios** | Leyendo el buscador |

**El 1 es el que justifica esta revisión entera.** La fase 4 cerró H4 diciendo «ocho decimales: una
docena da 0,08333333 por pieza y doce piezas suman 1». Se amplió la columna a `decimal(18,8)` y el
value object aceptaba ocho decimales, pero **la multiplicación seguía en cuatro**. Reproducido
contra la API local: artículo con la caja como base y la pieza a 0,08333333, doce piezas daban
**0,9996 cajas**. Y un factor más fino que 0,00005 —un gramo de un saco de 25 kg— se recortaba a
**cero**: veinticinco mil gramos entraban como nada.

Dato incómodo y útil: el sistema de referencia, que calcula en coma flotante con
`round($cantidad * $factor, 4)`, **acierta** en este caso. No recortaba el factor, solo el
resultado. Aquí se recortaban los dos.

El 2 se reprodujo creando cinco artículos llamados igual y recorriendo el listado de uno en uno:
el primero salía **dos veces** y el segundo **ninguna**, igual en la segunda vuelta. Ese artículo
era invisible también en los selectores de pedidos, órdenes, ajustes y kardex, que recorren páginas.

### 12.3 Decisiones de Rafael

**El aviso de reposición compara contra la existencia proyectada** (`existencia − reservado + en
camino`), no contra la física. Es la cuenta de ERPNext (*Projected Qty = Actual + Ordered −
Reserved*) y de Odoo. El motivo: comparar contra lo físico manda a comprar otra vez lo que ya viene
del proveedor, y calla sobre lo que ya está vendido. Se descartó quedarse en lo físico —el aviso
seguiría mintiendo— y quedarse a medias con el disponible, que arregla la mitad barata y deja la
cara.

**Quitar «se compra» o «se vende» se rechaza con documentos abiertos de ese lado**, igual que
desactivar. Los borradores no cuentan, coherente con la decisión ya tomada de que un borrador no
compromete nada. Se descartó dejarlo pasar —un borrador quedaba sin poder confirmarse— y también
bloquear por borradores, que contradecía esa decisión.

### 12.4 Qué cambió

| Hallazgo | Qué cambió | Dónde se prueba |
|---|---|---|
| 1 | Los tres `Quantity.times()` escalan el factor a ocho decimales y redondean **una sola vez** al final | `quantity.vo.spec.ts` de inventario, ventas y compras: doce piezas de una docena dan 1, y veinticinco mil gramos de un saco dan 1 |
| 2 | El orden del listado desempata por identificador, en la base **y** en el doble en memoria | Contrato de puerto: cinco homónimos, paginados de uno en uno, salen los cinco |
| 3 | `ItemStopsBeingTradedError`: `ensureCanChange` mira las banderas, y **cada lado mira sus propios documentos** | `item-commitments.spec.ts` (5 casos) y contrato: el puerto dice de qué lado viene cada documento abierto |
| 4 | El repositorio traduce la violación del índice de código de barras a `DuplicateBarcodeError`, como ya hacía con el SKU | Contrato, contra el doble y contra PostgreSQL |
| 5 | Puerto `ExpectedStock` con adaptador que lee pedidos y órdenes sin importar código de esos contextos, como ya hacía el kardex con los códigos de sus documentos. La pantalla muestra existencia, reservado, en camino y proyectada | `low-stock.spec.ts` (lo que viene no se vuelve a pedir; lo reservado sí resta) y contrato de `ExpectedStock` contra PostgreSQL |
| 6 | El bajo mínimo salta bodegas desactivadas y servicios | `low-stock.spec.ts` |

De extremo a extremo, en `item-protection.api.spec.ts`: un artículo con una orden de compra abierta
**no puede dejar de comprarse** y sí de venderse, y vuelve a poder en cuanto la orden se anula; y un
artículo con mínimo 240 deja de pedirse cuando una orden trae diez cajas de 24, y vuelve a pedirse
si esa orden se anula.

**Lo que la semilla acabó demostrando sola.** Al cambiar el cálculo, las dos pruebas del bajo mínimo
fallaron: el agua tenía 288 contra un mínimo de 300, pero la propia semilla ya traía una orden de
compra con **144 en camino** y un pedido con 72 reservados. Proyectada: 360. **El agua no había que
pedirla**, y el sistema llevaba desde la fase 4 diciendo que sí.

Los datos de demostración quedan enseñando los dos casos: el agua, que parece faltar y no falta; y el
detergente, que tiene 50, vende 10 y recibe 20 —proyectada 60— contra un mínimo de 80, y sí falta. Su
mínimo se subió a propósito, porque con el cálculo nuevo ningún artículo de la empresa de ejemplo
quedaba bajo mínimo y la pantalla salía vacía.

### 12.5 La interfaz, a mano

Recorrido en Chrome de las dos pantallas que tocó esta revisión, con los datos de demostración.

- **Bajo mínimo** muestra las cuatro columnas y el detergente con sus cifras: 50 de existencia, 10
  reservados, 20 en camino, 60 proyectada contra un mínimo de 80, faltan 20. El agua no aparece.
- **Un detalle que ninguna prueba habría visto:** el texto de cabecera seguía diciendo «artículos con
  menos **existencia** que el mínimo», que dejó de ser verdad en cuanto el cálculo pasó a la
  proyectada. Corregido para que explique la resta completa.
- **La regla de las banderas, probada usándola:** quitarle «Vender» al agua —que tiene un pedido
  abierto— se rechaza en pantalla con «Hay órdenes de compra o pedidos de venta abiertos con este
  artículo: recíbelos, despáchalos o anúlalos antes de dejar de comprarlo o de venderlo», y el
  listado sigue diciendo «Comprar · Vender».

### 12.6 Lo que este paso enseñó

1. **Ampliar la columna no es ampliar el cálculo.** Un cambio de precisión hay que perseguirlo por
   cada multiplicación, no solo por el esquema y el value object que valida la entrada.
2. **Un contrato de puerto puede dar un falso verde.** El doble en memoria ordenaba estable y no
   reproducía el defecto de paginación; solo falló contra PostgreSQL. Cuando el doble y la base no
   ordenan igual, el contrato deja de decir la verdad.
3. **Comparar con la referencia también sirve cuando la referencia acierta.** Su cálculo del factor
   es peor de forma y mejor de resultado, y eso fue lo que confirmó que el defecto era nuestro.
4. **Una guarda que exige clasificar cada error nuevo se gana el sitio**: la suite señaló el error
   que faltaba por catalogar sin que nadie se acordara de hacerlo.
5. **Cuando una prueba falla al cambiar una regla, primero hay que preguntarse cuál de las dos está
   equivocada.** Las dos del bajo mínimo fallaron, y no porque el cálculo nuevo estuviera mal: la
   semilla llevaba desde la fase 4 pidiendo comprar agua que ya venía en camino. La prueba defendía
   el defecto.
