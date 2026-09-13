# H4 — Compras: informe de las fases 0 a 6

Hecho de corrido, **sin commitear**, con la misma dinámica del H2 y el H3: cada fase completa,
revisión rigurosa del código, del sistema y de las pruebas, y este informe para que Rafael lo
revise antes de repartirlo en commits.

**Alcance aprobado** (13-sep-2026): proveedores, orden de compra con lo que viene en camino y
entrada de mercancía con recepción parcial, **generalizando la publicación del inventario** para que
la entrada mueva existencia por el mismo motor que el ajuste. Fuera: cuentas por pagar, devoluciones
a proveedor, aprobaciones por monto y costos de importación (anotados en `FUTURE.md`).

La documentación funcional, con cada regla y ejemplo, está en [`modulos/compras.md`](modulos/compras.md).

---

## Fase 0 — Modelo y migración

**Migración:** `20260913200000_create_purchasing_context`.

| Tabla | Para qué |
|---|---|
| `suppliers` | Proveedor: nombre único, identificación fiscal libre, contacto y plazo de pago |
| `purchase_orders` | La orden: proveedor, bodega de destino, fechas y estado |
| `purchase_order_lines` | Artículo, unidad, cantidad, cantidad base, costo, **tasa de impuesto copiada** y **cantidad recibida** |
| `goods_receipts` | La entrada: su orden, la bodega de la orden, fecha y estado |
| `goods_receipt_lines` | Qué línea de la orden llegó, cuánto y a qué costo |

**Decisiones.**

- **La base prohíbe recibir más de lo pedido**: `CHECK received_quantity <= quantity`, además del
  dominio y del bloqueo.
- Claves ajenas **compuestas con la empresa** hacia proveedores, órdenes, líneas, artículos,
  unidades y bodegas. Una línea de entrada no puede apuntar a una línea de orden de otra empresa.
- `@@unique([receiptId, orderLineId])`: una línea de la orden aparece una sola vez por entrada.
- El kardex **no cambió de esquema**: `origin_type` ya era texto y ahora admite `receipt`.

---

## Fase 1 — Dominio

### Generalización del inventario

| Pieza | Qué cambió |
|---|---|
| `stock/posting/stock-movements.ts` | **Nuevo motor puro**: `record(documento, líneas)` y `reverse(documento)`. Lo que antes vivía dentro de la confirmación y la anulación del ajuste |
| `stock/posting/stock-ledger.ts` | El `Ledger` (existencias bloqueadas y movimientos del documento), ya sin saber de ajustes |
| `adjustment/posting/*` | `AdjustmentConfirmation` y `AdjustmentCancellation` delegan en el motor |
| `movement/` | `MovementOrigin.type` es `'adjustment' \| 'receipt'` |
| `documents/movement-documents.ts` | Puerto para leer el código de cualquier documento del kardex |

El motor agrupa las existencias por **artículo y bodega**; antes, dentro del ajuste, bastaba el
artículo porque un ajuste tiene una sola bodega.

### Contexto de compras

`apps/api/src/contexts/purchasing/domain/`, con `TenantId`, referencias, `Quantity`, `UnitCost` y
`TaxRate` **propios**: compras no importa nada del inventario ni del catálogo.

| Pieza | Qué es |
|---|---|
| `supplier/` | `Supplier` con sus validaciones; `SupplierFinder` y `SupplierUniqueness` |
| `order/purchase-order.entity.ts` | El agregado y su ciclo: borrador → confirmada → recibida en parte ⇄ recibida, y anulada |
| `order/purchase-order-line.ts` | Lo pendiente, lo pendiente en unidad base, subtotal e impuesto en céntimos |
| `order/lines/purchase-order-references.ts` | Proveedor y bodega activos, artículos inventariados, factor de hoy e impuesto copiado |
| `receipt/goods-receipt.entity.ts` | La entrada: orden y bodega fijas, una línea por línea de orden |
| `receipt/lines/goods-receipt-line-factory.ts` | Arma las líneas desde la orden y no deja pasar más de lo pendiente |
| `receipt/posting/*` | `ReceiptConfirmation` y `ReceiptCancellation` puros, que devuelven qué hacer con la existencia: nada, recibir o revertir |

**Reglas** (cada una con su prueba):

- **No se recibe más de lo pendiente**, también sumando varias líneas de una misma entrada, y
  **todas las líneas se validan antes de registrar ninguna**.
- Anular una entrada **devuelve la orden al estado que corresponda** a lo que queda recibido.
- **No se anula una orden con mercancía recibida.**
- Montos redondeados **una vez por línea**: 10 cajas a 12 con 16 % y 2,5 kg a 4 exentos dan
  130,00 + 19,20 = 149,20.
- Lo pedido menos lo recibido **da cero exacto** tras cien recepciones de 0,1.

---

## Fase 2 — Aplicación

| Caso de uso | Qué hace |
|---|---|
| `SupplierCreator` / `Updater` / `StatusChanger` / `Searcher` | El maestro, sin gastar correlativo si el alta es inválida |
| `PurchaseOrderCreator` / `Updater` | Borrador nuevo o reemplazado entero |
| `PurchaseOrderConfirmer` | **Revalida con el catálogo de hoy conservando los identificadores de línea** y confirma con la orden bloqueada |
| `PurchaseOrderCanceller` | Anula con la orden bloqueada |
| `PurchaseOrderSearcher` | Con proveedor, bodega, artículos, pendiente y totales resueltos |
| `GoodsReceiptCreator` / `Updater` | Borrador desde su orden |
| `GoodsReceiptConfirmer` | Revalida el borrador y publica |
| `GoodsReceiptCanceller` | Anula por la publicación, también un borrador |
| `IncomingStockSearcher` | En camino por artículo y bodega, en unidad base |

Los dobles viven en `infrastructure/testing/`: un almacén que imita la transacción y el bloqueo, con
un **inventario de juguete** que cuenta unidades y rechaza revertir lo que ya salió.

---

## Fase 3 — Infraestructura: publicación transaccional

**El contrato publicado.** `shared/prisma/document-stock-posting.ts` (`DOCUMENT_STOCK_POSTING`):

```ts
receive(tx, tenantId, { type: 'receipt', id }, entries, now)
reverse(tx, tenantId, { type: 'receipt', id }, now)
```

Lo implementa el inventario (`PrismaDocumentStockPosting`) con el mismo bloqueo y la misma escritura
que el ajuste, extraídos a `prisma-stock-ledger.ts`. `InventoryModule` **solo exporta eso**.

**Por qué recibe la transacción.** La entrada cambia su estado, el de su orden y la existencia. Si
el inventario abriera su propia transacción, una entrada podría quedar confirmada sin existencia, o
al revés. Recibirla es explícito; la alternativa (una transacción implícita por `AsyncLocalStorage`)
contradice «explícito sobre automático». Por eso vive en infraestructura: ningún dominio la ve.

**`PrismaReceiptPosting`**, en una transacción:

1. Bloquea la entrada (`FOR UPDATE`).
2. Bloquea su orden (`FOR UPDATE`). Dos entradas de la misma orden esperan en fila.
3. Ejecuta el trabajo puro del dominio.
4. Escribe entrada y orden.
5. Pide al inventario recibir o revertir: bloquea existencias en orden fijo y escribe el kardex.

**Orden de bloqueo global:** documento → orden → existencias. Un ajuste bloquea documento →
existencias. Nadie toma una orden después de una existencia: no hay ciclos posibles.

**Traducción de errores.** Si el inventario lanza `InsufficientStockError` al revertir, compras
responde `ReceivedGoodsAlreadyUsedError`, con su propio mensaje.

**Contrato de puertos** (`purchasing-ports.contract.ts`): 14 casos contra el doble y contra
PostgreSQL **con el inventario real** detrás. Los que importan:

- Confirmar escribe entrada, orden y existencia juntas; si lo pendiente no alcanza, **no queda nada**.
- **Dos entradas de 6 sobre una orden de 10 confirmadas a la vez**: una entra, la otra `409`.
- La misma entrada confirmada dos veces a la vez: entra una sola vez.
- **Anular la orden mientras una entrada la recibe**: gana una de las dos, nunca las dos.
- Anular una entrada cuya mercancía ya salió: se rechaza sin tocar nada.

Además, `unique-violation.ts` se movió del catálogo a `shared/prisma/`: compras también traduce
duplicados, y copiarlo o importarlo del catálogo habría sido peor.

---

## Fase 4 — API

- **15 rutas** bajo `/api/v1/purchasing`, un controlador por acción; confirmar y anular son rutas
  propias con su permiso.
- **15 permisos** en `PURCHASING_PERMISSIONS` (50 en total). `route-declaration.spec` los cruza en
  ambas direcciones.
- **11 ataques nuevos** en la matriz de aislamiento contra proveedores, órdenes y entradas de Globex,
  y la fotografía de Globex antes y después incluye sus compras.
- La vigilancia de la matriz reconoce ahora `supplierId`, `orderId` y `orderLineId`.

---

## Fase 5 — Frontend

| Pantalla | Qué hace |
|---|---|
| `/compras/ordenes` | Tabla con líneas, lo recibido, total con IVA y estado. Panel con editor de líneas. **«Recibir mercancía»** abre un panel con lo pendiente propuesto y crea la entrada en borrador |
| `/compras/entradas` | Revisar, editar, confirmar y anular (revierte la existencia) |
| `/compras/en-camino` | Por artículo y bodega, con las órdenes que lo aportan y filtro en la dirección |
| `/compras/proveedores` | Reutiliza `CatalogTable`: mismo panel, misma política de desactivar |

- `modules/purchasing/` sin React: tipos, acciones por estado, resúmenes, líneas recibibles y
  `readablePurchasingError`, que encadena con los mensajes del inventario, el catálogo y el acceso.
- La barra lateral muestra **Compras** según permisos, y el kardex muestra el tipo de documento
  («Ajuste» o «Entrada de compra»).

---

## Fase 6 — Semillas y pruebas end-to-end

- **Semillas** (`seedPurchasing`): en Acme, dos proveedores, una orden recibida en parte con su
  entrada confirmada (el agua pasa de 240 a 336, con su movimiento en el kardex) y un borrador. En
  Globex, los blancos de la matriz. El rol Consulta ve compras.
- **API** (`tests/api/purchasing.api.spec.ts`, 14 pruebas): recorrido completo por HTTP, costo
  promedio con dos compras a distinto precio (240 a 0,50 y 240 a 1 → 0,75), entradas simultáneas,
  anular y retroceder, mercancía que ya salió por un ajuste, permisos y sesión.
- **Interfaz** (`tests/ui/purchasing.spec.ts`, 4 pruebas): pedir → en camino → recibir 4 de 10 →
  recibida en parte → 96 en existencias → «Entrada de compra» en el kardex → anular y volver a 0;
  error en español al pasarse; proveedor con plazo; solo lectura.

---

## Revisión rigurosa

Se revisó el código, se probó el sistema a mano por API y se corrió cada suite contra el sistema
levantado. Lo que apareció:

| Hallazgo | Cómo apareció | Arreglo |
|---|---|---|
| **Confirmar una orden regeneraba los identificadores de sus líneas.** Un cliente que leyó el borrador y luego recibía por esos identificadores obtenía `ReceiptLineNotInOrderError` | Prueba de API: la segunda orden se recibía con las líneas leídas antes de confirmar | La revalidación conserva el identificador de cada línea, en órdenes y en entradas. Prueba de aplicación nueva |
| **El proveedor llamaba `taxId` a su identificación fiscal**, cuando en el sistema `taxId` es la referencia a un impuesto | La vigilancia de la matriz marcó `POST /suppliers` como ruta con identificador sin ataque | Renombrado a `fiscalId` (`fiscal_id`). La prueba tenía razón: el nombre engañaba también a una persona |
| El motor genérico agrupaba existencias solo por artículo | Revisión del código al extraerlo del ajuste | Por artículo **y** bodega, con prueba propia (`stock-movements.spec.ts`) |
| El doble de `fetch` de la web reutilizaba el mismo `Response` | Prueba unitaria de la web | Un `Response` nuevo por llamada |
| `GoodsReceiptUpdater` provocaba el error de «no editable» llamando a `update` con los datos viejos | Revisión del código | Lanza el error explícito |
| El doble en memoria de compras implementaba interfaces con métodos que solo lanzaban | Revisión del código | Expone cada puerto por separado, sin métodos falsos |

**Decisiones que conviene revisar con Rafael.**

- **La única composición entre contextos**: `PurchasingModule` importa `InventoryModule` para
  obtener `DOCUMENT_STOCK_POSTING`, y el arnés de PostgreSQL del contrato de compras compone el
  inventario real. Ningún archivo de dominio ni de aplicación importa otro contexto
  (`architecture.spec` lo vigila). Queda pendiente la regla propuesta en el H2: que esa prueba
  prohíba importar entre contextos salvo en módulos y arneses.
- **La migración de compras se editó después de aplicarse en local** (renombre de `tax_id`). No
  había salido de la máquina; en la base local se renombró la columna y se actualizó la huella en
  `_prisma_migrations`. `migrate diff` contra el esquema da vacío.
- **Un borrador de entrada queda huérfano si se anula su orden**: no se puede confirmar, solo anular.
  Se prefirió eso a anular entradas en cascada sin que nadie lo pida.

---

## Validación

`make verify` completo en verde:

| Suite | Resultado |
|---|---|
| API unitarias | 1543 |
| Web unitarias | 107 |
| Contrato contra PostgreSQL | 96 |
| End-to-end | 217 |

Además, a mano por API sobre las semillas: `OC000001` recibida en parte con 4 de 10 cajas, en camino
144 un de agua y 20 kg de detergente, kardex del agua con `ENT000001` como movimiento 2 y saldo 336,
y confirmar la entrada de Globex desde Acme responde 404.
