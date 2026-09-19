# Revisión: Inventario › Ajustes

**Fecha:** 19-sep-2026 · **Estado:** ✅ cerrado · El documento que corrige existencias
([README](../README.md))

Segunda revisión hecha con la skill `module-review` en modo **módulo sin revisar**: etapa 2 completa
y matriz. El sistema de referencia es `verlumyx/erp`, leído **en su código**.

---

## 1. Qué hace hoy el sistema

Un ajuste es un documento corto: cabecera con bodega, fecha y notas, y líneas con artículo, unidad,
dirección (entra o sale), cantidad y —solo al entrar— costo. Su ciclo no tiene vuelta atrás:
**borrador → confirmado → anulado**, y anular un confirmado no borra nada, escribe la contrapartida.

Lo que ya estaba bien, comprobado uno por uno:

- **Una transacción con bloqueo explícito**: bloquea la fila del ajuste con `FOR UPDATE`, después
  sus existencias en orden fijo, ejecuta el dominio puro y escribe cabecera, movimientos y
  existencias juntos (`prisma-adjustment-posting.ts:28-58`).
- **Revalidación del borrador contra el catálogo de hoy** antes de mover nada: si el artículo se
  desactivó, o su caja pasó de 24 a 12, no se confirma con cantidades viejas.
- **Bloqueo optimista del borrador**: dos personas editando, la segunda no pisa a la primera.
- **Permisos granulares y separados**: `search`, `create`, `update`, `confirm`, `cancel`. Que
  `confirm` sea independiente de `create` ya es segregación de funciones.
- **Dos líneas del mismo artículo acumulan bien**, y una salida que no alcanza aborta el ajuste
  entero sin escribir nada. Reproducido contra la API: 409.
- **`AdjustmentPosting` y `AdjustmentRepository` tenían contrato de puerto**, al contrario de lo que
  pasó con `StockUsage` en el Catálogo.
- **El ajuste de salida ignora las reservas de ventas a propósito**, documentado y con Odoo como
  fuente: registra algo que ya pasó.

## 2. Qué debería hacer

**El sistema de referencia** (`verlumyx/erp`, módulo `app/Modules/Adjustment/`), leyendo su código.
En este submódulo está **bastante por delante**:

- Captura **cantidad contada**, no delta: `countedQuantity − system` es la diferencia
  (`AdjustmentLimitsService::guardDirection`).
- **Ocho tipos** obligatorios y un campo `reason`: `physical_count`, `loss`, `damage`, `expiration`,
  `theft`, `correction`, `revaluation`, `other` (`Models/Adjustment.php:31-34`).
- **Revaluación como tipo propio**: «el único tipo en el que el usuario define el costo unitario».
- **Cinco estados**, con `pending_approval` entre borrador y confirmado.
- **Aprobación por umbral**: por encima de un importe configurable, el ajuste lo firma alguien
  distinto de quien lo registró. Su porqué, textual: «un documento que mueve existencia sin una
  operación comercial detrás es el agujero natural de un inventario».
- **El costo del sobrante** (`AdjustmentStockService::averageOf`): sale del saldo que se está
  contando y, «sin existencia sobre la que ponderar —un sobrante de algo que el sistema daba por
  agotado— se usa el promedio del maestro de artículos».
- También lotes, series, ubicaciones y un `count_id` que ata el ajuste a un conteo físico.

**El sector**, con cita verificable:

| | Delta o contado | Motivo | Revaluación |
|---|---|---|---|
| [Odoo](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/count_products.html) | Contado: «the difference between the On Hand Quantity and Counted Quantity» | No en el núcleo; un módulo lo añade *(secundaria)* | Sí |
| [ERPNext](https://docs.frappe.io/erpnext/user/manual/en/stock-reconciliation) | Contado: «the quantity will be changed as required» | `Purpose` + cuenta de diferencia | Sí, con `Valuation Rate` |
| [Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/reason-codes-for-counting-journals) | Contado | **Códigos de razón, configurables como obligatorios** | Sí |
| Referencia | Contado | Ocho tipos, obligatorio | Tipo propio |

**Y el consenso sobre el costo**: en Odoo el promedio es del **producto**, no de la bodega —«operating
on a company-wide basis rather than per warehouse»—, igual que el maestro de artículos de la
referencia. El nuestro es por artículo **y bodega**, y ahí está la raíz del hallazgo H1.

## 3. Comparar

| Regla | Sistema | Referencia | Sector | Veredicto |
|---|---|---|---|---|
| Borrador → confirmado → anulado, sin borrar nada | Sí | Sí | Sí | **Ya correcto** |
| Anular revierte citando el movimiento original | Sí | Sí | Sí | **Ya correcto** |
| No revertir si la mercancía ya salió | Sí | Sí | Sí | **Ya correcto** |
| Una transacción con bloqueo de filas | Sí, explícito | Sí | — | **Ya correcto** |
| Permiso de confirmar separado del de crear | Sí | Sí | Sí | **Ya correcto** |
| La salida ignora las reservas de ventas | Sí, a propósito | Sí | Sí (Odoo) | **Ya correcto** |
| **Costo de una entrada sin saldo previo** | **Cero** | Promedio del maestro | Promedio del producto | **Falta** → H1 |
| **La fecha del documento llega al kardex** | **No** | — | — | **Falta** → H2 |
| Motivo del ajuste | **No** | Ocho tipos | 3 de 4 lo tienen | **A decidir** → H3 |
| Revaluación de costo sin mover cantidad | **No** | Tipo propio | Sí | **A decidir** → H4 |
| Listado paginado y con filtros | **No** | Sí | Sí | **A decidir** → H5 |
| Rastro de quién lo hizo | **No** | Sí | Sí | **A decidir** → H6 |
| Qué se captura | Delta | Contado | Contado | **A decidir** → sigue el delta |
| Aprobación por umbral de importe | No | Sí | Sí | **A decidir** → hito propio |

## 4. Decisiones de Rafael

**El costo del sobrante cae al promedio del artículo**, y si no hay existencia en ninguna bodega se
exige escribirlo. Se descartó mover el promedio al nivel de artículo, como Odoo: resuelve el mismo
problema pero toca kardex, existencias, valuación y todos los documentos, y es un hito, no un
arreglo. Se descartó también exigir siempre el costo: obligaría a inventar un número en el caso
frecuente —contar en una bodega que ya tiene saldo—, donde el promedio vigente es la respuesta
correcta.

**El kardex enseña las dos fechas.** El movimiento conserva el instante de la publicación, porque el
saldo corrido se calcula en ese orden y es el orden en que la existencia cambió de verdad; y además
guarda la fecha que el documento declara. Se descartó que el movimiento tomara la fecha del
documento: al ordenar por fecha, la columna de saldo quedaría incoherente.

**El motivo se construye con los ocho tipos de la referencia**, obligatorio. Se descartó la lista
corta propia que estaba anotada en `FUTURE.md` (conteo inicial, conteo, merma, daño, hallazgo)
porque los ocho ya separan daño de merma, de vencimiento y de robo, que es justo lo que un informe
de mermas necesita distinguir.

**La revaluación se construye con el motor que ya hay.** El kardex no sabe escribir un movimiento de
cantidad cero, así que se expresa como lo que es: sale todo al costo viejo y vuelve a entrar al
nuevo. Se descartó dejar «Revaluación» como etiqueta sin comportamiento, que es exactamente lo que
se le criticó a la retención del sistema de referencia en el Catálogo: un dato que nadie consume.

**El listado se pagina y se filtra**, como quedó Artículos en la fase 4.

**El ajuste guarda quién lo registró y quién lo cerró**, y solo el ajuste. Se descartó hacerlo en los
siete contextos de golpe: eso es un hito, y la pregunta de fondo —quién le pasa el usuario al
dominio— se responde mejor módulo por módulo. Queda anotado en `FUTURE.md`.

**Se sigue capturando el delta**, no la cantidad contada. El delta cubre merma, daño, robo y hallazgo,
que es el uso frecuente; la cantidad contada solo aporta en un conteo físico de verdad, y ese
necesita además congelar el saldo al contar y recomprobarlo al confirmar. Es un documento propio, no
un campo: anotado en `FUTURE.md`.

**La aprobación por umbral no se construye ahora**, y queda como hito propio con su alcance escrito.
Mismo criterio que con la retención en el Catálogo.

## 5. Los hallazgos

### H1 · ALTA · Una entrada sin costo en una bodega vacía entraba valorada en cero

`stock-movements.ts:39` resolvía el costo ausente con el promedio de **esa bodega**, y
`ItemStock.empty()` nace en cero. **Reproducido contra la API local**: ajuste de entrada de 100
unidades de agua en la bodega Norte, sin costo → `quantity: 100, averageCost: 0, totalValue: 0`.
La misma agua vale 0,50 en Principal.

No era solo la valuación: ese cero se queda en la bodega y **toda salida posterior sale valorada a
cero**. Y la documentación decía «se valora al costo promedio vigente» sin mencionar el caso, así
que código y documentación divergían justo en el borde.

**La referencia lo resuelve y nosotros no**, lo cual confirma que era defecto propio y no diferencia
de criterio.

**Corregido**: el puerto `Ledger` gana `averageCostOf`, que devuelve el promedio del artículo en toda
la empresa ponderado por bodega, leído al bloquear. Sin existencia en ninguna,
`UnknownEntryCostError` (409).

### H2 · MEDIA · La fecha del documento no llegaba al kardex

`adjustment-confirmation.ts` escribía el movimiento con el reloj, no con `adjustment.date()`.
**Reproducido**: ajuste fechado el 10 de agosto, confirmado el 19 de septiembre → el movimiento
quedaba con `occurredAt` del 19. El documento decía una fecha y el kardex otra.

Es **transversal**: las entradas de compra y los despachos hacían lo mismo. Y el kardex **no
mostraba ninguna fecha**, así que la divergencia era invisible hasta consultarla por la API.

**Corregido**: `inventory_movements` gana `origin_date`, rellenada en la migración desde cada
documento de origen. El kardex estrena columna de fecha y añade «Registrado el …» solo cuando las dos
difieren.

### H3 · MEDIA · El ajuste no decía por qué se hacía

Solo notas libres y opcionales. Estaba anotado en `FUTURE.md`; esta revisión lo convirtió en
decisión. **Corregido**: ocho motivos obligatorios, con índice para filtrar por ellos. Un motivo
desconocido se rechaza con 400.

### H4 · MEDIA · No había forma de corregir un costo equivocado

Si la existencia estaba valorada mal, la única salida era inventar movimientos de cantidad.
**Corregido**: la revaluación, que saca todo al costo viejo y lo devuelve al nuevo. Anularla deshace
en orden inverso, que es lo único que devuelve el promedio exactamente a donde estaba.

### H5 · MEDIA · El listado traía todos los ajustes de la empresa

`searchByTenant` devolvía **cada ajuste con todas sus líneas** y ordenaba en memoria; el `?page=`
que se le mandara se ignoraba. Artículos se había paginado en la fase 4 y Ajustes se quedó atrás.

**Corregido**: paginación por código y filtros por texto, bodega, estado, motivo y rango de fechas,
en la API y en la pantalla, con los filtros viajando en la dirección.

### H6 · MEDIA · No quedaba constancia de quién hacía el ajuste

`user_id` solo aparecía en las membresías: **ningún documento del sistema guardaba su autor**. En un
documento que mueve existencia sin una operación comercial detrás, eso es el hueco que la referencia
describe con todas las letras.

**Corregido en el ajuste**: `created_by`, `confirmed_by` y `cancelled_by`, nulables para lo ya
escrito, con el puerto `DocumentAuthors` que resuelve los nombres **por membresía** —quien ya no es
de la empresa no se nombra en sus documentos— y su contrato de puerto.

### H7 · BAJA · Las etiquetas de los filtros quedaban pegadas a su control

Encontrado **recorriendo la pantalla**, que es lo único que lo encuentra: la etiqueta de cada filtro
se pintaba en la misma línea que su control («Bodega[Todas]») porque le faltaba `block`. El mismo
descuido estaba en el buscador de Artículos, un módulo ya cerrado. **Corregido en los dos.**

Y una tercera cosa que se vio ahí y **no** se corrigió: en los listados que usan `CatalogTable`, el
buscador se pinta **antes** del título de la sección, así que la pantalla empieza por la herramienta.
Arreglarlo toca un componente compartido por cuatro módulos, así que quedó anotado en
[FUTURE.md](../../FUTURE.md) en vez de hacerse sobre la marcha.

### H8 · BAJA · La documentación pública citaba el sistema privado del empleo

Seis menciones por nombre en `docs/PLAN.md`, `docs/RETOMAR.md` y `docs/modulos/inventario.md`, en un
repositorio público. **Corregido** con redacción neutra, en su propio commit.

## 6. Lo que este paso enseñó

1. **El contrato de puerto encontró el defecto que el doble escondía, otra vez.** El caso nuevo de
   `DocumentAuthors` pasó contra el doble y falló contra PostgreSQL: al arnés le faltaban las
   personas y sus membresías. Es el mismo patrón del Catálogo, en dirección contraria.
2. **Una cobertura alta no protege los bordes.** 22 de 23 reglas del ajuste tenían una prueba que se
   habría puesto roja al borrarlas, y aun así pasaron dos defectos: las pruebas que faltaban eran
   justo las del borde —la bodega sin saldo previo y la fecha atrasada—. La prueba de «entrada sin
   costo» existía, pero solo probaba el caso feliz.
3. **La interfaz a mano volvió a encontrar lo que ninguna prueba puede.** Dos defectos de
   presentación, uno de ellos en un módulo ya cerrado. Una prueba comprueba que el filtro filtra; no
   que la etiqueta esté donde tiene que estar.
4. **Revisar un módulo encuentra cosas que no son del módulo.** La fecha del kardex resultó
   transversal a tres contextos, el rastro de autor faltaba en los siete, y las menciones al sistema
   privado no tenían nada que ver con Ajustes.
5. **Cuando la referencia acierta, hay que decirlo.** Su `averageOf` resuelve exactamente el caso
   que aquí entraba en cero. Leer su código, y no su documentación, es lo que lo hizo visible.
