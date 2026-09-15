# Compras

**A quién** se le compra, **qué** se le pidió, **qué viene en camino** y **qué ya entró** a las
bodegas.

Contexto: `apps/api/src/contexts/purchasing` · Pantallas: `/compras/*` · Informe técnico:
[`../H4-COMPRAS.md`](../H4-COMPRAS.md)

| Submódulo | Tabla | Prefijo | Qué es |
|---|---|---|---|
| Proveedores | `suppliers` | `PRV` | A quién se le compra |
| Órdenes de compra | `purchase_orders`, `purchase_order_lines` | `OC` | Lo que se le pide a un proveedor para una bodega |
| Entradas de mercancía | `goods_receipts`, `goods_receipt_lines` | `ENT` | Lo que llegó de una orden; al confirmarse sube la existencia |
| En camino | — (se calcula de las órdenes) | — | Lo pedido en órdenes confirmadas que todavía no llegó |

**Depende de** Catálogo (artículos, unidades, impuestos, bodegas), que lee por su propio puerto, y de
**Inventario**, al que le pide mover la existencia por un contrato publicado. No importa el código
de ninguno de los dos.

---

## Principios

1. **La orden no mueve existencia.** Confirmada, *anuncia* lo que viene en camino. Solo la entrada
   confirmada sube la existencia.
2. **Nunca entra más de lo pedido.** Lo impide el dominio, lo impide un bloqueo de la orden bajo
   concurrencia y lo impide la base (`CHECK received_quantity <= quantity`).
3. **El inventario sigue siendo el único que escribe kardex y existencias.** Compras le pasa las
   líneas de la entrada; el inventario aplica el mismo motor que a un ajuste.
4. **Entrada, orden y existencia cambian juntas o no cambia ninguna.** Una sola transacción.
5. **Nada se borra.** Un proveedor se desactiva; una orden o una entrada se anulan.

---

## 1. Proveedores — `suppliers`

| Campo | Tipo | Regla |
|---|---|---|
| `code` | `PRV000001` | Asignado al crear |
| `name` | texto(150) | Obligatorio, **único por empresa** |
| `fiscal_id` | texto(30) | Opcional. **Texto libre**: validar el RIF queda para más adelante |
| `email` | texto(150) | Opcional; si se escribe, tiene que ser un correo |
| `phone` | texto(40) | Opcional |
| `address` | texto(500) | Opcional |
| `payment_term_days` | entero | De 0 a 365. **0 es contado**. Por defecto 0 |
| `is_active` | sí/no | Uno inactivo **no recibe órdenes nuevas** |

**Reglas**

- Dos altas simultáneas con el mismo nombre: la base rechaza la segunda y se responde `409`.
- Desactivar no toca las órdenes que ya tiene. Sus borradores ya no se pueden confirmar, porque
  confirmar revalida el proveedor.
- Renombrar cambia cómo se leen todas sus órdenes, también las viejas: las órdenes guardan el
  identificador, no el nombre.

---

## 2. Órdenes de compra

### 2.1 Cabecera — `purchase_orders`

| Campo | Tipo | Regla |
|---|---|---|
| `code` | `OC000001` | Asignado al crear |
| `supplier_id` | proveedor | De la empresa y **activo** |
| `warehouse_id` | bodega | Bodega de destino. De la empresa y **activa** |
| `order_date` | fecha | Por defecto hoy. **No puede ser futura** |
| `expected_date` | fecha | Opcional. **Sí puede ser futura**, pero no anterior a la de la orden |
| `notes` | texto(500) | Opcional |
| `currency` | char(3) | La elige quien captura; **por defecto, la de la empresa**. Existe y está activa |
| `exchange_rate` | decimal(18,8) | Bolívares por 1 unidad de `currency`, **de la fecha del documento o la última anterior**. 1 si es el bolívar |
| `base_currency` | char(3) | La moneda de la empresa **en ese momento** |
| `base_exchange_rate` | decimal(18,8) | Bolívares por 1 unidad de `base_currency`, siempre del catálogo de tasas |
| `manual_exchange_rate` | booleano | La tasa la escribió una persona (si la empresa lo permite) |
| `status` | ver ciclo de vida | |

### 2.2 Líneas — `purchase_order_lines`

| Campo | Tipo | Regla |
|---|---|---|
| `item_id` | artículo | De la empresa, **activo** e **inventariado**. Un servicio no se recibe en una bodega |
| `unit_id` | unidad | **Una de las unidades del artículo** |
| `quantity` | decimal(18,4) | Mayor que cero, en la unidad de la línea |
| `base_quantity` | decimal(18,4) | `quantity × factor`, calculada |
| `unit_cost` | decimal(18,6) | Cero o más, **por unidad de la línea, sin impuesto** |
| `tax_rate` | decimal(7,4) | **Copiado del impuesto del artículo** al escribir la línea; 0 si no tiene |
| `received_quantity` | decimal(18,4) | Lo que sumaron las entradas confirmadas, en la unidad de la línea |

**Por qué se copia el impuesto.** Si mañana el IVA cambia, la orden sigue diciendo lo que se pactó.

**Montos**, redondeados a céntimos una sola vez por línea:

```
subtotal de la línea = cantidad × costo
impuesto de la línea = subtotal × tasa / 100
total de la orden    = Σ subtotales + Σ impuestos
```

Ejemplo: 10 cajas a 12 con 16 % y 5 kg a 3,20 exento → subtotal 136,00, impuesto 19,20, total 155,20.

### 2.3 Ciclo de vida

```
 borrador ──confirmar──▶ confirmada ──entrada──▶ recibida en parte ──entrada──▶ recibida
    │                        │          ◀──anular entrada──        ◀──anular entrada──
    └──────anular───────▶ anulada ◀──anular── (solo si no se recibió nada)
```

| Estado | Qué se puede hacer | Qué anuncia |
|---|---|---|
| **Borrador** | Editar (se reemplaza entera), confirmar, anular | Nada |
| **Confirmada** | Recibir, anular | Todo lo pedido está en camino |
| **Recibida en parte** | Recibir el resto | Lo pendiente sigue en camino |
| **Recibida** | Nada (salvo anular una entrada, que la hace retroceder) | Nada |
| **Anulada** | Nada | Nada |

**Reglas**

- **Confirmar revalida el borrador con los maestros de hoy**: proveedor, bodega y artículos activos.
  **Si la caja de un artículo cambió desde que se escribió** (10 cajas pedidas con 24 que hoy serían
  120), la orden no se confirma (`PurchaseItemChangedError`): se revisa, se guarda —guardar recalcula
  con el factor de hoy— y se confirma. Un borrador no se reinterpreta en silencio. **Conserva los identificadores de las
  líneas**, así que quien leyó el borrador puede recibir por ellos.
- **Al confirmar, los artículos de la orden se bloquean en modo compartido** y se vuelve a comprobar
  que sigan activos, inventariados y con el factor con que se calcularon las cantidades base. Si
  cambiaron entre la revalidación y el bloqueo, la orden no se confirma (`PurchaseItemChangedError`,
  409) y basta con volver a intentarlo. Confirmada, el maestro de artículos ya no deja desactivar el artículo
  ni cambiar la unidad que usa.
- **No se anula una orden con mercancía recibida**: primero se anulan sus entradas. Lo recibido ya
  está en la bodega y anular la orden no lo devolvería.
- El estado **lo calcula la orden** a partir de lo recibido: todo recibido es «recibida», nada es
  «confirmada», lo demás es «recibida en parte».
- Anular una orden con entradas en borrador es posible: esas entradas ya no se podrán confirmar,
  solo anular.

### 2.4 Moneda y tasas

La orden guarda su moneda y **las dos tasas que congela**: la de su moneda y la de la moneda de la empresa, ambas en
bolívares por unidad. Con los dos pares se reexpresa en bolívares y en la moneda de la empresa aunque esta cambie
después. Las pide al contexto de empresa por el contrato publicado `DocumentRates`
([empresa.md §4](empresa.md#4-tasas-de-cambio--exchange_rates)).

| Momento | Qué pasa con las tasas |
|---|---|
| **Crear o editar el borrador** | Se buscan otra vez: la del día de la orden o la última anterior, de la serie de la empresa |
| **Confirmar** | Se buscan una última vez y **quedan congeladas**. Cargar después otra tasa no cambia la orden |
| **Tasa escrita a mano** | Se conserva al editar y al confirmar. Solo si la empresa lo permite, y nunca para su moneda ni para el bolívar |

- **Sin tasa, la orden no se guarda** (`MissingExchangeRateError`, 409): ni la de su moneda ni la de la empresa pueden
  faltar. Mejor no emitir que emitir con tasa 1.
- La fecha futura se rechaza **antes** de buscar tasas.
- Una moneda retirada del catálogo no se elige; un borrador que ya la tenía la conserva al guardarse.
- **Las órdenes anteriores al multimoneda** quedaron en la moneda de la empresa y **sin tasas**: así se escribieron.
- En la pantalla, el total lleva la moneda y, debajo, la tasa y su equivalente en bolívares.

---

## 3. Entradas de mercancía

### 3.1 Cabecera — `goods_receipts`

| Campo | Tipo | Regla |
|---|---|---|
| `code` | `ENT000001` | Asignado al crear |
| `order_id` | orden | De la empresa, **confirmada o recibida en parte**. No cambia |
| `warehouse_id` | bodega | **La de la orden**. No cambia |
| `receipt_date` | fecha | Por defecto hoy. **No puede ser futura** |
| `notes` | texto(500) | Opcional |
| `currency` | char(3) | **La de su orden**. No cambia |
| `exchange_rate` | decimal(18,8) | Bolívares por 1 unidad de `currency`, **del día en que llegó o la última anterior**. 1 si es el bolívar |
| `base_currency` | char(3) | La moneda de la empresa **en ese momento** |
| `base_exchange_rate` | decimal(18,8) | Bolívares por 1 unidad de `base_currency`, siempre del catálogo de tasas |
| `manual_exchange_rate` | booleano | La tasa la escribió una persona (si la empresa lo permite) |
| `status` | `draft` \| `confirmed` \| `cancelled` | |

### 3.2 Líneas — `goods_receipt_lines`

| Campo | Regla |
|---|---|
| `order_line_id` | Una línea **de su orden**, y **una sola vez** por entrada |
| `item_id`, `unit_id` | Copiados de la línea de la orden |
| `quantity` | Mayor que cero y **no más de lo pendiente** en esa línea |
| `base_quantity` | **La proporcional de la línea de la orden**: 4 de 10 cajas que la orden guardó como 240 unidades son 96, aunque el artículo cambie después su caja |
| `unit_cost` | **El de la orden**. La entrada no negocia precios |

### 3.3 Ciclo de vida

| Paso | Qué pasa en la orden | Qué pasa en el inventario |
|---|---|---|
| **Crear borrador** | Nada. Se comprueba que no supere lo pendiente *hoy* | Nada |
| **Editar borrador** | Nada | Nada |
| **Confirmar** | Suma lo recibido y **vuelve a comprobar lo pendiente con la orden bloqueada** | Entra la cantidad base al costo por unidad base; recalcula el costo promedio |
| **Anular un borrador** | Nada | Nada |
| **Anular una confirmada** | Resta lo recibido; la orden retrocede de estado | Revierte los movimientos con contrapartidas. **Se rechaza si la mercancía ya salió** |

**Costo que entra al inventario**: el de la orden repartido en unidades base **y llevado a la moneda de la
empresa con las tasas de la entrada**, porque el inventario se valora en la moneda de la empresa. 4 cajas de 24 a 12
dólares entran como 96 unidades a 0,50. Si la orden es en euros, con el euro a 175,05 Bs y el dólar a 153,10 Bs, esas
96 unidades entran a 0,50 × 175,05 ÷ 153,10 = **0,571685** dólares.

**Tasas de la entrada.** Lleva la moneda de su orden, pero **las tasas del día en que llegó**: la mercancía se valora
cuando entra. Se refrescan en el borrador y se congelan al confirmar; una escrita a mano se conserva.

**Dos borradores que juntos se pasan.** Sobre 10 cajas, dos borradores de 6 son válidos por
separado. Al confirmar, el primero entra y el segundo se rechaza con «La entrada trae más de lo que
queda pendiente en la orden». Si se confirman a la vez, la orden bloqueada los pone en fila.

---

## 4. En camino

`GET /api/v1/purchasing/incoming` agrupa, por **artículo y bodega**, lo pendiente de las órdenes
**confirmadas o recibidas en parte**, en unidad base, con cada orden que lo aporta y su fecha
esperada.

- Un borrador **todavía no promete nada**; una orden anulada o recibida, **ya no**.
- Con 10 cajas pedidas y 4 recibidas, en camino hay 144 unidades.
- Filtrar por una bodega de otra empresa responde `404`, como en el resto del sistema.

---

## 5. Cómo se mueve la existencia

La entrada no escribe el kardex: se lo pide al inventario por un **contrato publicado**,
`shared/prisma/document-stock-posting.ts`.

```
PrismaReceiptPosting (compras)                     PrismaDocumentStockPosting (inventario)
 1. bloquea la entrada        SELECT … FOR UPDATE
 2. bloquea su orden          SELECT … FOR UPDATE
 3. trabajo puro del dominio  (confirmar o anular)
 4. escribe entrada y orden
 5. receive / reverse  ─────────────────────────▶  6. bloquea existencias en orden fijo
                                                    7. mismo motor que el ajuste (StockMovements)
                                                    8. escribe kardex y existencias
 └──────────────────── una sola transacción ─────────────────────────────┘
```

- **La transacción la abre compras y la recibe el inventario.** Por eso el contrato vive en la
  frontera de infraestructura: los dominios no saben de transacciones.
- **El orden de bloqueo es siempre documento → orden → existencias.** Un ajuste bloquea su documento
  y luego existencias; nadie bloquea una orden después de una existencia, así que no hay ciclos.
- **Traducción de errores.** El inventario dice `InsufficientStockError`; compras lo traduce a
  `ReceivedGoodsAlreadyUsedError`: «parte de la mercancía de esta entrada ya salió».
- En el kardex, la entrada aparece con su código `ENT…` y el tipo **«Entrada de compra»**.

---

## 6. API y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Listar proveedores | `GET /api/v1/purchasing/suppliers` | `purchasing.suppliers.search` |
| Crear proveedor | `POST /api/v1/purchasing/suppliers` | `purchasing.suppliers.create` |
| Editar proveedor | `PUT /api/v1/purchasing/suppliers/:supplierId` | `purchasing.suppliers.update` |
| Activar o desactivar | `PUT /api/v1/purchasing/suppliers/:supplierId/status` | `purchasing.suppliers.deactivate` |
| Listar órdenes | `GET /api/v1/purchasing/orders` | `purchasing.orders.search` |
| Crear orden | `POST /api/v1/purchasing/orders` | `purchasing.orders.create` |
| Editar borrador | `PUT /api/v1/purchasing/orders/:orderId` | `purchasing.orders.update` |
| Confirmar | `PUT /api/v1/purchasing/orders/:orderId/confirm` | `purchasing.orders.confirm` |
| Anular | `PUT /api/v1/purchasing/orders/:orderId/cancel` | `purchasing.orders.cancel` |
| Listar entradas | `GET /api/v1/purchasing/receipts` | `purchasing.receipts.search` |
| Crear entrada | `POST /api/v1/purchasing/receipts` | `purchasing.receipts.create` |
| Editar borrador | `PUT /api/v1/purchasing/receipts/:receiptId` | `purchasing.receipts.update` |
| Confirmar | `PUT /api/v1/purchasing/receipts/:receiptId/confirm` | `purchasing.receipts.confirm` |
| Anular | `PUT /api/v1/purchasing/receipts/:receiptId/cancel` | `purchasing.receipts.cancel` |
| En camino | `GET /api/v1/purchasing/incoming?warehouseId=` | `purchasing.incoming.search` |

**Ejemplo: crear una orden**

```json
POST /api/v1/purchasing/orders
{
  "supplierId": "e8000000-0000-4000-8000-000000000001",
  "warehouseId": "e3000000-0000-4000-8000-000000000001",
  "expectedDate": "2026-09-20",
  "notes": "Reposición quincenal",
  "lines": [
    { "itemId": "e4000000-0000-4000-8000-000000000001", "unitId": "e0000000-0000-4000-8000-000000000002", "quantity": 10, "unitCost": 12 }
  ]
}
```

**Ejemplo: recibir 4 cajas de esa línea**

```json
POST /api/v1/purchasing/receipts
{ "orderId": "…", "lines": [{ "orderLineId": "…", "quantity": 4 }] }
```

**Errores más frecuentes**

| Código | HTTP | Cuándo |
|---|---|---|
| `DuplicateSupplierNameError` | 409 | Otro proveedor de la empresa ya tiene ese nombre |
| `InactiveSupplierError` | 409 | Orden a un proveedor inactivo |
| `ServiceNotPurchasableError` | 400 | Una línea es un servicio |
| `PurchaseItemChangedError` | 409 | Un artículo cambió mientras se confirmaba la orden: se vuelve a intentar |
| `PurchaseOrderNotEditableError` | 409 | Editar una orden que no es borrador |
| `PurchaseOrderWithReceiptsError` | 409 | Anular una orden que ya recibió mercancía |
| `PurchaseOrderNotReceivableError` | 409 | Recibir de un borrador, una anulada o una ya recibida |
| `ReceiptExceedsPendingError` | 409 | La entrada supera lo pendiente |
| `ReceivedGoodsAlreadyUsedError` | 409 | Anular una entrada cuya mercancía ya salió |

---

## 7. Pantallas

| Ruta | Qué muestra |
|---|---|
| `/compras/ordenes` | Órdenes con proveedor, bodega, líneas con lo recibido, total con IVA y estado. Menú: recibir mercancía, editar, confirmar, anular. Panel de orden con líneas dinámicas y panel de recepción con lo pendiente propuesto |
| `/compras/entradas` | Entradas con su orden y proveedor, lo que llegó y el estado. Menú: editar, confirmar, anular (revierte la existencia) |
| `/compras/en-camino` | Por artículo y bodega, lo que viene y de qué órdenes, con filtro por bodega en la dirección |
| `/compras/proveedores` | Maestro con identificación fiscal, contacto y plazo («Contado» o «N días») |

- El módulo aparece en la barra lateral solo si el rol puede ver alguna de sus secciones.
- Los menús ofrecen solo lo que el estado permite; la API lo vuelve a comprobar.
- **Las entradas se crean desde su orden** («Recibir mercancía»): así nunca se elige una orden que
  no admite recepción.

---

## 8. Datos de demostración

| Empresa | Qué hay |
|---|---|
| Acme | **Distribuidora Andina** (`J-30512345-6`, 30 días) y **Aguas del Valle** (contado) |
| Acme | `OC000001` a Andina, **recibida en parte**: 10 cajas de agua a 12 (4 recibidas) y 20 kg de detergente a 3,10 |
| Acme | `ENT000001` **confirmada**: 4 cajas = 96 unidades a 0,50. El agua de Principal pasa de 240 a **336** |
| Acme | `OC000002` a Aguas del Valle, **borrador** |
| Acme | En camino: **144 un** de agua y **20 kg** de detergente en Principal |
| Globex | Repuestos Industriales; `OC000001` confirmada, `OC000002` borrador y `ENT000001` en borrador. Son los blancos de la matriz de aislamiento |

El rol **Consulta** de Acme ve proveedores, órdenes, entradas y lo que viene en camino, pero no
compra.

---

## 9. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio | `contexts/purchasing/domain/**/*.spec.ts` | Montos en céntimos, cantidades exactas, proveedor, ciclo de la orden (recibir todo o nada, retroceder al anular), ciclo de la entrada, confirmación y anulación puras |
| Aplicación | `supplier-lifecycle.spec.ts`, `purchase-cycle.spec.ts` | Proveedores; órdenes con revalidación y conservación de líneas; en camino; entradas parciales, dos borradores que se pasan, anular y retroceder, mercancía que ya salió |
| Contrato | `purchasing-ports.contract.ts` | 14 casos contra doble y PostgreSQL con el inventario real: atomicidad, **dos entradas simultáneas que no caben**, doble confirmación, **anular la orden mientras una entrada la recibe** |
| API | `tests/api/purchasing.api.spec.ts` | Recorrido por HTTP, costo promedio con dos compras, entradas simultáneas, anulación con retroceso, permisos |
| Interfaz | `tests/ui/purchasing.spec.ts` | Pedir → en camino → recibir en parte → existencias → kardex → anular entrada; error en español; proveedor; solo lectura |
| Aislamiento | `tests/isolation/*` | 11 ataques: proveedores, órdenes y entradas de Globex, pedirle a su proveedor, recibir su orden y filtrar lo que le viene en camino |
| Moneda y tasas | `application/purchase-currency.spec.ts`, `document-currency.spec.ts`, `tests/api/purchasing.api.spec.ts`, `tests/ui/purchasing.spec.ts` | La moneda de la empresa por defecto, tasas que se refrescan en el borrador y se congelan al confirmar, tasa a mano, sin tasa no se guarda, la entrada con las tasas de su día y el costo en la moneda de la empresa |
