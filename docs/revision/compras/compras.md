# Revisión: Compras

**Fecha:** 19-sep-2026 · **Estado:** ✅ cerrado · A quién se le compra, qué se le pidió, qué viene
en camino y qué ya entró ([README](../README.md))

Quinta revisión con la skill `module-review`, y la primera **en lote**: los cuatro submódulos
—Proveedores, Órdenes de compra, Entradas de mercancía y En camino— auditados en una sola pasada.

---

## 1. Qué hace hoy el sistema

Compras es un módulo **maduro**, y se nota: la orden no mueve existencia —confirmada sólo *anuncia*
lo que viene—, nunca entra más de lo pedido (lo impiden el dominio, un bloqueo de la orden y un
`CHECK` de la base), y el inventario sigue siendo el único que escribe kardex, por un contrato
publicado. Entrada, orden y existencia cambian en una sola transacción, con el orden de bloqueo
declarado: documento → orden → existencias.

Por eso los hallazgos de este módulo **no son errores de cálculo como los de Inventario**, sino
otra cosa: reglas que el sistema ya adoptó en otros módulos y aquí faltan, y una cifra que se
calcula en dos sitios con dos criterios.

## 2. Qué debería hacer

**El sistema de referencia** (`app/Modules/{Supplier,PurchaseOrder,Entry}/`), leído en su código.
Le lleva ventaja en tres cosas reales —copia el plazo de pago a la orden, guarda `created_by`,
`approved_by` y el motivo de anulación, y permite recibir de más con un permiso propio y un tope— y
en una cuarta que **resulta ser otra etiqueta muerta**, como su FIFO: sus costos adicionales.

**El sector:** ERPNext y los ERP del ramo separan lo pedido de lo recibido y avisan de lo atrasado;
ninguno cuenta un servicio como mercancía esperada.

## 3. Comparar

| Regla | Sistema | Referencia | Sector | Veredicto |
|---|---|---|---|---|
| La orden no mueve existencia; sólo la entrada confirmada | Sí | Sí | Sí | **Ya correcto** |
| Nunca entra más de lo pedido (dominio, bloqueo y `CHECK`) | Sí, triple | Sí, con permiso para excederlo | Sí | **Ya correcto** |
| Entrada, orden y existencia en una transacción | Sí | Por servicios encadenados | — | **Mejor que la referencia** |
| El inventario es el único que escribe kardex | Sí, contrato publicado | Sí | Sí | **Ya correcto** |
| Importes con enteros escalados, un redondeo por línea | Sí | Coma flotante | — | **Mejor que la referencia** |
| Nada se borra: se anula | Sí | Sí | Sí | **Ya correcto** |
| **No cerrar un maestro con documentos abiertos** | **No** (proveedor) | **No** (sólo mira saldo) | Sí | **Falta** → H2 |
| **El servicio no es mercancía en camino** | **No** | Sí | Sí | **Falta** → H8 |
| **Listados paginados y con filtros** | **No** | Sí, 20 por página y 14 criterios | Sí | **Falta** → H1 |
| **Condiciones de pago congeladas en el documento** | **No** | Sí | Sí | **Falta** → H5 |
| **Avisar de lo que ya debía llegar** | **No** | Parcial (`received_percent`) | Sí | **Falta** → H4 |
| Pedir un documento por su identificador | **No** | Sí | Sí | **A decidir** → diferido |
| Costos adicionales prorrateados | No | **Declarado y sin implementar** | Sí | **No se copia** |
| Rastro de autor en el documento | No | Sí | Sí | Ya decidido: hito propio |

## 4. Cómo se hizo, y por qué así

Rafael pidió revisar los cuatro submódulos **en lote**: auditar los cuatro, anotar todo, corregir de
una vez y revalidar de una vez. El ahorro es real y está en no pagar cuatro veces lo que se paga
una: la suite entera, la reconstrucción de contenedores y la pasada de interfaz.

**Lo que no se difirió fue la comprobación.** Cada hallazgo se reprodujo contra la API local
*durante* la auditoría, no después. Reproducir cuesta un script de dos minutos; no reproducir
produce listas de sospechas donde depurar los falsos positivos cuesta más que haberlos encontrado.
Esta tanda lo confirma: **dos de los catorce candidatos no se sostuvieron**, y están anotados abajo.

**Lo que NO se difiere:** cada hallazgo se reproduce contra la API local antes de anotarse. Un
hallazgo sin reproducir es una sospecha, y depurar sospechas cuesta más que encontrarlas.

Sistema de referencia: `verlumyx/erp`, clonado y leído **en su código**.

Estados: 🔴 reproducido, sin construir · 🟢 construido · ⚪️ descartado, con el porqué

---

## Índice de hallazgos

| # | Gravedad | Submódulo | Hallazgo | Estado |
|---|---|---|---|---|
| H1 | MEDIA | Los cuatro | Ningún listado pagina, y `limit` y `q` se ignoran en silencio | 🟢 |
| H2 | **ALTA** | Proveedores | Un proveedor se desactiva con órdenes abiertas, y se le sigue recibiendo | 🟢 |
| H3 | MEDIA | Los cuatro | No existe `GET /:id`: ningún documento de Compras se puede pedir por su identificador | ⚪️ diferido |
| H4 | BAJA | En camino | No distingue lo que viene de lo que **ya debía haber llegado** | 🟢 |
| H5 | MEDIA | Órdenes | El plazo de pago del proveedor no se congela en la orden | 🟢 |
| H6 | MEDIA | Los cuatro | Los esquemas no rechazan lo que no entienden: un campo mal escrito se acepta en silencio | 🟢 |
| H7 | MEDIA | Entradas | Una entrada se puede fechar **antes que su propia orden**, y llega así al kardex | 🟢 |
| H8 | **ALTA** | En camino | Un **servicio** se cuenta como mercancía en camino, y no se va nunca | 🟢 |
| H9 | MEDIA | Entradas | La pantalla ofrece recibir líneas de servicio, y el error no está traducido | 🟢 |
| H10 | BAJA | En camino | Se traen todas las órdenes de la empresa y se filtran en memoria | 🟢 |
| H11 | BAJA | Entradas | El listado mezcla borradores y anuladas, sin filtro de estado | 🟢 |
| H12 | BAJA | Entradas | El borrador se guarda fuera de la transacción que publica | ⚪️ diferido |
| H13 | MEDIA | Órdenes y Entradas | Filtrar por un proveedor, bodega u orden de otra empresa devolvía lista vacía en vez de 404 | 🟢 |

---

## H1 · MEDIA · Ningún listado de Compras pagina, y los parámetros se ignoran en silencio

**Los cuatro submódulos.** Es el mismo defecto que se corrigió en Ajustes, Existencias y Kardex; el
módulo entero se quedó fuera de aquella tanda.

**Reproducido** contra la API local, sesión `ana@acme.com`:

```
GET /purchasing/suppliers            -> 200, claves ["suppliers"]          (sin total/limit/offset/hasMore)
GET /purchasing/orders               -> 200, claves ["orders"]
GET /purchasing/receipts             -> 200, claves ["receipts"]
GET /purchasing/incoming             -> 200, claves ["incoming"]
GET /purchasing/suppliers?limit=1    -> 200, devuelve 2 filas    (limit ignorado)
GET /purchasing/orders?limit=1&offset=0 -> 200, devuelve 2 filas (ignorados)
GET /purchasing/suppliers?q=Andina   -> 200, devuelve 2 filas    (q ignorado)
```

Lo segundo es peor que lo primero: un parámetro que se acepta y no hace nada miente a quien lo usa.
Existencias devuelve `{ total, limit, offset, hasMore }`; aquí no hay nada de eso.

## H2 · ALTA · Un proveedor se desactiva con órdenes abiertas, y se le sigue recibiendo mercancía

`OC000001` de **Distribuidora Andina** está *recibida en parte*: 10 cajas pedidas, 4 recibidas, **6
pendientes**. Con esa orden abierta:

```
PUT /purchasing/suppliers/{andina}/status {active:false}  -> 200   (nada lo impide)
POST /purchasing/receipts   (1 caja de esa orden)         -> 201   (se crea)
PUT  /purchasing/receipts/{id}/confirm                    -> 200   (ENTRA a la bodega)
```

La existencia sube y el costo promedio se recalcula **en nombre de un proveedor inactivo**.

**El contraste está dentro del propio sistema.** El Catálogo construyó, y este método validó, la
regla «una bodega no se desactiva si tiene existencia o documentos abiertos» — fue el hallazgo
grave de la revisión del Catálogo. El maestro de proveedores no tiene la regla equivalente, y la
documentación funcional la describe como decisión: «Desactivar no toca las órdenes que ya tiene»
([modulos/compras.md §1](../../modulos/compras.md)).

Dos maestros del mismo sistema responden distinto a la misma pregunta —*¿qué le pasa a lo que ya lo
usa cuando este maestro se cierra?*—, y sólo uno de los dos puede tener razón.


## H3 · MEDIA · Ningún documento de Compras se puede pedir por su identificador

```
GET /purchasing/orders/{id}     -> 404 Cannot GET
GET /purchasing/receipts/{id}   -> 404 Cannot GET
GET /purchasing/suppliers/{id}  -> 404 Cannot GET
```

Sólo existen los listados. Consecuencias que ya se notan:

- **No hay forma de enlazar a un documento.** El kardex muestra `ENT000001` y no puede llevar a esa
  entrada; «En camino» nombra `OC000001` y no puede llevar a esa orden.
- La pantalla tiene que **traerse el listado entero** y buscar dentro, que es justo lo que H1
  vuelve caro en cuanto haya volumen: los dos hallazgos se agravan mutuamente.

## H4 · BAJA · «En camino» no distingue lo que viene de lo que ya debía haber llegado

`OC000001` promete llegar el **2026-09-10**. Hoy es el **19**: nueve días de retraso, y la pantalla
lo muestra en gris, igual que cualquier otra fecha (captura de `/compras/en-camino`).

«En camino» es la pantalla donde se mira antes de reclamarle a un proveedor. Si no separa lo
atrasado, hay que compararlo con el calendario a ojo, fila por fila.

## H5 · MEDIA · El plazo de pago del proveedor no se congela en la orden

`suppliers.payment_term_days` existe y se muestra («Contado» o «N días»), pero **la orden no lo
copia**: `PurchaseOrder` no tiene la columna (`apps/api/prisma/schema.prisma:702-732`), así que el
plazo de una orden se lee del proveedor **como esté hoy**.

**El sistema ya decidió lo contrario para todo lo demás que se pacta.** La línea copia `tax_rate` al
escribirse, con este porqué textual: «Si mañana el IVA cambia, la orden sigue diciendo lo que se
pactó» ([modulos/compras.md §2.2](../../modulos/compras.md)). El SKU y el nombre se copian por lo
mismo. El plazo de pago es del mismo tipo: es una condición pactada, no un dato del maestro.

Hoy nadie lo consume —no existe Cuentas por pagar—, y el criterio del propio sistema dice que un
campo se añade cuando existe el flujo que lo usa. La diferencia es que **este campo ya existe**: lo
que falta no es el dato, es congelarlo. Cuando Cuentas por pagar lo necesite, las órdenes viejas ya
no podrán decir con qué plazo se pactaron.

## H6 · MEDIA · Los esquemas aceptan en silencio lo que no entienden

Ningún esquema de Compras es estricto, así que **una clave mal escrita se acepta y se ignora**. Se
descubrió al intentar retrofechar una entrada con `receiptDate` —el campo se llama `date`—: la API
respondió `201` y la entrada quedó con la fecha de hoy, sin una sola queja.

```
POST /purchasing/receipts { orderId, receiptDate: '2026-07-01', lines: […] }
  -> 201, y la entrada queda fechada HOY
```

`goods-receipt.request.dto.ts:5-11` define el objeto sin `.strict()`; lo mismo en el resto. Es la
misma raíz de H1: `limit`, `offset` y `q` se aceptan porque nada obliga a que existan.

**Por qué importa más de lo que parece:** quien integre contra esta API no recibe ningún error al
equivocarse de nombre. El documento se crea, con otro dato, y el fallo aparece mucho después.

## H7 · MEDIA · Una entrada se puede fechar antes que su propia orden

`OC000001` es del **2026-09-02**. Una entrada suya fechada el **2026-07-01** se crea y **se
confirma**:

```
POST /purchasing/receipts { orderId: OC000001, date: '2026-07-01', … } -> 201  (ENT000018, fecha 2026-07-01)
PUT  /purchasing/receipts/{id}/confirm                                  -> 200
```

La mercancía «llegó» dos meses antes de pedirse. La entidad sólo comprueba que la fecha no sea
futura (`goods-receipt.entity.ts:182`); nadie la compara con la de su orden.

**Esto pesa más desde la revisión de Ajustes**, que hizo viajar la fecha del documento al kardex
(`movement_origin_date`) y añadió al Kardex el filtro por esa fecha. Un movimiento de entrada
fechado en julio se lista en julio, antes de que existiera la orden que lo explica.

## H8 · ALTA · Un servicio se cuenta como mercancía en camino, y no se va nunca

Hay **dos definiciones de «en camino» en el sistema**, y no coinciden. Coinciden en los estados
(`confirmed`, `partially_received`), en la resta (`quantity − received`) y en la unidad base. Difieren
en una sola palabra:

```sql
-- Inventario, puerto ExpectedStock (prisma-expected-stock.ts:31-38)
WHERE l.tenant_id = … AND l.moves_stock
  AND o.status IN ('confirmed','partially_received') AND l.quantity > l.received_quantity
```
```ts
// Compras, En camino (incoming-stock-searcher.ts:38-41)
for (const line of order.lines()) {
  const pending = line.pendingBase();
  if (pending.isZero()) continue;      // nadie mira movesStock
```

**Reproducido** con una orden mixta —10 kg de mercancía y 5 de un servicio— confirmada:

```
EN CAMINO (Compras)          BAJO MÍNIMO (Inventario)
  DETERGENTE-1KG  30 kg        DETERGENTE-1KG  en camino: 30
  SERV-ENTREGA     5 un        (no aparece)
```

**Y no es sólo una fila de más: es una fila eterna.** Un servicio no se puede recibir —la fábrica de
líneas lanza `ServiceNotReceivableError` (`goods-receipt-line-factory.ts:54`)—, así que su
`received` **nunca sube** y su pendiente nunca baja. La línea se queda anunciando mercancía que
jamás va a entrar, hasta que alguien anule la orden entera.

Es el mismo patrón que el H2 de Existencias: **la misma cifra calculada en dos sitios con dos
reglas**, y sólo uno de los dos se corrigió cuando la regla cambió.

## H9 · MEDIA · La pantalla ofrece recibir servicios, y el error que devuelve no está traducido

La respuesta de órdenes **no expone `movesStock`** (`purchase-order-searcher.ts:11-26`), así que
`receivableLines` filtra sólo por `pendingQuantity > 0` (`purchasing.ts:133-137`) y el formulario de
recepción ofrece también las líneas de servicio (`receipt-fields.tsx:66-87`).

Quien las marque recibe `ServiceNotReceivableError`, que **no está en el mapa de mensajes de la
interfaz** (`purchasing-error.ts:4-50`): en vez de una frase en español, sale el texto crudo.

Y **ninguna prueba lo provoca**: el error sólo se instancia en la prueba que comprueba su categoría
HTTP. Es una regla que existe, que la interfaz invita a disparar, y que nadie defiende.

## H10 · BAJA · «En camino» trae todas las órdenes de la empresa y filtra en memoria

`prisma-purchase-order.repository.ts:62-70` hace `findMany({ where: { tenantId }, include: { lines: true } })`
—sin filtro de estado, sin `take`— y el descarte de borradores, anuladas y recibidas ocurre después,
en JavaScript (`incoming-stock-searcher.ts:33`). Con los índices `(tenantId, status)` ya creados y
sin usar (`schema.prisma:732`).

Es H1 en su peor versión: no es que no pagine, es que **trae también todo lo que va a descartar**.

## H11 · BAJA · El listado de entradas mezcla borradores y anuladas sin filtro de estado

`goods-receipt-searcher.ts:44-57` devuelve las tres clases de entrada juntas y no acepta filtro de
estado. Un borrador a medias y una anulada se leen igual que una confirmada, y ninguna columna
ayuda a separarlas más que el texto del estado.

## H12 · BAJA · El borrador se guarda fuera de la transacción que publica

Al confirmar una entrada, `receipts.save(receipt)` escribe **en su propia transacción**
(`goods-receipt-confirmer.ts:54` → `prisma-goods-receipt.repository.ts:19`) **antes** de la
transacción que publica. Si la publicación falla después, el borrador queda con las líneas y la tasa
ya refrescadas: un efecto a medias de una operación que se anunció atómica.

No rompe nada hoy —el borrador sigue siendo un borrador válido—, pero contradice el principio 4 del
módulo: «Entrada, orden y existencia cambian juntas o no cambia ninguna».

## H13 · MEDIA · Filtrar por algo de otra empresa devolvía una lista vacía

**Lo encontró la guarda de aislamiento, no la auditoría.** Al añadir los filtros de H1, las rutas de
órdenes y entradas pasaron a aceptar `supplierId`, `warehouseId` y `orderId`; el escáner que vigila
que *toda ruta que recibe un identificador tenga su ataque* falló al instante y obligó a escribirlos.
Al escribirlos apareció el defecto: esos filtros no comprobaban de quién era el identificador, así
que filtrar por un proveedor de otra empresa devolvía **una lista vacía**.

Una lista vacía y un `404` dicen cosas distintas: la primera afirma que **ese proveedor no tiene
órdenes**, y eso ya es contar algo de otra empresa. El resto del sistema responde «no existe»
—Existencias, Ajustes y el propio «En camino» lo hacían— y ahora también aquí.

**Es el mismo hallazgo que apareció en Ajustes**, por el mismo motivo: un filtro nuevo sobre un
identificador es una puerta nueva, y hay que tratarla como tal.

**Y de paso se corrigió la guarda:** su segunda aserción comparaba el número de rutas escaneadas
contra el número de ataques, dando por hecho **un ataque por ruta**. Pero `/orders` acepta dos
identificadores y necesita dos ataques. Ahora compara contra rutas cubiertas distintas, que es lo
que de verdad quería decir.

---

## Lo que NO se construyó, y por qué

**H3 · Pedir un documento por su identificador.** Son tres rutas, tres casos de uso con la misma
resolución de nombres que ya hacen los buscadores, sus pruebas y su fila en la matriz de
aislamiento. **No se construyó porque no es un defecto, es una comodidad**: nada del sistema deja de
funcionar sin ella, y con la búsqueda que H1 acaba de añadir se llega a un documento concreto
escribiendo su código. Lo que hoy cuesta es enlazar desde el kardex a la entrada que lo explica.
Alcance en [FUTURE.md](../../FUTURE.md).

**H12 · El borrador se guarda fuera de la transacción que publica.** Mover ese `save` dentro exige
que la revalidación entera —catálogo, tasas, pendiente— ocurra bajo la transacción, que es
precisamente lo que el diseño evita para no sostener bloqueos mientras se consulta el catálogo.
**No se construyó porque no produce ningún estado inválido**: lo que queda escrito es un borrador
válido con sus líneas y su tasa al día, no un documento a medias. Se anota porque contradice el
principio 4 del módulo tal como está redactado, y lo honesto es que el principio diga lo que el
código hace.

---

## Lo que el sistema de referencia resuelve, y lo que sólo aparenta resolver

**Le lleva ventaja en tres cosas concretas:**

- **Copia el plazo de pago del proveedor a la orden** al elegirlo, editable
  (`usePurchaseOrderForm.ts:289-304`). Es H5, y allí está construido.
- **Guarda quién y por qué**: `created_by`, `approved_by`, `approved_at`, `cancellation_reason`
  (migración de órdenes, `:43-46,51`). Aquí ya se decidió dejar el rastro de autor para más
  adelante, en la revisión de Ajustes.
- **Recibir de más**, permitido sólo con un permiso propio y con tope
  (`EntryLimitsService.php:179-243`).

**Y una cuarta que resulta ser otra etiqueta muerta**, como su FIFO: los **costos adicionales**.
Tiene `landed_cost` en la línea de la entrada y lo lleva al kardex
(`EntryPostingService.php:237`), pero `landed_cost` **se calcula como copia exacta de `unit_cost`**
(`EntryRepository.php:474-483`). No prorratea flete ni aduana en ninguna parte: el nombre promete un
costo puesto en almacén y entrega el costo de compra. **No se copia**, por el mismo motivo por el
que no se copió su FIFO ni su retención.

**Y una diferencia de criterio, no de calidad:** al confirmar una orden, la referencia **crea sola
una entrada en borrador** con las líneas pendientes (`PurchaseOrderMirrorEntryService.php:53-60`), y
al recibir parcial genera otra con el saldo. Aquí las entradas se crean desde la orden cuando llega
la mercancía. Anotado, no adoptado: un borrador que nadie pidió es un documento que alguien tiene
que cerrar.

**Lo que su proveedor tiene y el nuestro no**, con su veredicto:
`document_type` + `document_number` validados y únicos por empresa (**real**); contactos y
direcciones múltiples (**real**); tipos de proveedor (**no ramifica en ninguna regla**);
`credit_limit` y `lead_time_days` (**se capturan y no los consulta nadie en compras**).

---

## Falsos positivos, anotados a propósito

**«Anular una entrada la borra»** — Al anular, la entrada desapareció del listado y no estaba en la
base. Parecía contradecir el principio «nada se borra». **No se sostiene**: al reproducirlo de forma
controlada, `ENT000015` quedó `cancelled`, visible en el listado y presente en la tabla. La primera
observación mezclaba dos corridas. Se anota porque el método lo exige: un hallazgo sin reproducir
es una sospecha, y ésta habría costado un rato de código antes de descubrir que no existía.

**«Editar un borrador pierde los identificadores de las líneas, y la documentación dice que no»** —
Es cierto que editar los recrea (reproducido: la línea de `OC000002` cambió de id al guardarla). Pero
la afirmación de la documentación —«conserva los identificadores de las líneas»— está escrita sobre
**confirmar**, no sobre editar, y confirmar **sí** los conserva (reproducido también). Como de un
borrador no se puede recibir, ningún `orderLineId` en manos de nadie queda invalidado. **No es un
hallazgo**: el reemplazo entero del borrador es el diseño declarado, y no rompe nada que exista hoy.

---

## Notas de la corrida

- La base de desarrollo quedó con `ENT000015` y `ENT000016` anuladas, de las reproducciones.
  **`make seed` antes de la revalidación final.**
- Los datos de demostración volvieron solos a su sitio tras cada anulación: recibido 4, en camino
  144 un, existencia 288. La reversión funciona.

---

## 6. Lo que este paso enseñó

1. **La revisión en lote ahorra en la verificación, no en la auditoría.** Auditar cuatro submódulos
   cuesta lo mismo seguidos que separados; lo que se ahorra es correr una vez la suite entera,
   reconstruir una vez los contenedores y escribir una vez la prueba de capturas. Lo que **no** se
   puede meter en el lote es reproducir: un hallazgo sin reproducir no es un hallazgo, y dos de los
   de esta tanda se cayeron al comprobarlos.

2. **Un módulo maduro falla distinto que uno inmaduro.** En Inventario los hallazgos eran cálculos
   equivocados —un costo en cero, dos redondeos para la misma cifra—. Aquí el motor está bien y lo
   que falla es **coherencia entre módulos**: una regla que el Catálogo adoptó para las bodegas y
   que el proveedor no tiene, una definición de «en camino» que se corrigió en Inventario y no
   aquí. La pregunta que rinde ya no es «¿este cálculo está bien?» sino «¿esta regla vale en los
   dos sitios donde se aplica?».

3. **Una cifra calculada en dos sitios termina separándose, otra vez.** Es la cuarta vez que este
   patrón aparece —el valor del inventario, el promedio del ajuste, y ahora «en camino»—. Aquí las
   dos definiciones coincidían en todo menos en una palabra (`moves_stock`), lo que las hacía
   parecer la misma. Coincidir en casi todo es lo que impide notar la diferencia.

4. **Enumerar columnas a mano en un `UPDATE` es un generador de falsos verdes.** Al añadir el plazo
   de pago apareció **el mismo patrón que dejó `confirmed_by` sin escribir en Ajustes**: el
   `updateMany` lista las columnas una a una, así que una olvidada se guarda bien en el doble y no
   en la base, y toda la suite de aplicación pasa en verde. Por eso el plazo tiene su caso en el
   contrato de puertos, que corre contra PostgreSQL.

5. **Un parámetro que se acepta y no hace nada miente.** `limit`, `offset` y `q` se aceptaban y se
   ignoraban; `receiptDate` se tragó en silencio una fecha que el campo no se llamaba así. La causa
   era la misma en los dos casos —ningún esquema era estricto— y se arregló de una vez.
