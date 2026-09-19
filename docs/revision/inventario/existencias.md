# Revisión: Inventario › Existencias

**Fecha:** 19-sep-2026 · **Estado:** ✅ cerrado · Cuánto hay de cada artículo en cada bodega
([README](../README.md))

Tercera revisión con la skill `module-review`, modo **módulo sin revisar**. El sistema de referencia
es `verlumyx/erp`, leído en su código.

---

## 1. Qué hace hoy el sistema

`item_stocks` guarda una fila por artículo y bodega con la cantidad en unidad base, el costo
promedio y el número del último movimiento. Es **derivada**: sólo cambia cuando se escribe un
movimiento del kardex, en la misma transacción, y no hay ningún otro camino que la toque.

Lo que ya estaba bien:

- **No hay forma de tocar la cantidad sin dejar rastro.** Cada método que la cambia devuelve el
  movimiento que lo explica (`item-stock.entity.ts:20`).
- **La propiedad está probada, no sólo la funcionalidad**: el contrato comprueba, contra el doble y
  contra PostgreSQL, que la existencia es la suma de su kardex y que el saldo del último movimiento
  es la existencia.
- **Nunca negativa**, en el dominio y bajo concurrencia.
- **Filtrar por una bodega de otra empresa responde 404**, no una lista vacía.
- **Dinero y cantidades con enteros escalados**, donde la referencia usa coma flotante.

## 2. Qué debería hacer

**El sistema de referencia** (`app/Modules/ItemStock/`): su fila de existencia lleva
`reserved_quantity`, `incoming_quantity` y **`available_quantity`** además de la cantidad, y las
mantiene **denormalizadas** en cada movimiento —`availableQuantity: $quantity - $reserved`
(`ItemStockApplyMovementService`)—. Su listado **pagina** (`SearchItemStockCommand`: `limit = 20`,
`offset`) y filtra. Calcula el promedio con **float** y `round($quantity * $averageCost, 2)`.

**El sector:** [ERPNext](https://docs.frappe.io/erpnext/user/manual/en/projected-quantity) separa
«Actual Qty», «Reserved Qty» —«Quantity ordered for sale, but not delivered»— y «Ordered Qty», y
calcula `Projected Qty = Actual + Ordered − Reserved`. Es exactamente la fórmula que nuestra
pantalla de Bajo mínimo ya usaba.

## 3. Comparar

| Regla | Sistema | Referencia | Sector | Veredicto |
|---|---|---|---|---|
| La existencia sólo cambia por un movimiento del kardex | Sí | Sí | Sí | **Ya correcto** |
| La existencia es la suma de su kardex, probado como propiedad | Sí | — | — | **Ya correcto** |
| Nunca negativa | Sí, siempre | Configurable por bodega | Configurable | **Ya correcto**, decisión de alcance |
| Filtrar por bodega ajena responde 404 | Sí | — | — | **Ya correcto** |
| Dinero y cantidades con enteros escalados | Sí | **Coma flotante** | — | **Mejor que la referencia** |
| **Muestra reservado y disponible** | **No** | Sí, columnas propias | Sí | **Falta** → H1 |
| **El valor respeta los decimales de la empresa** | **No**, céntimos fijos | — | — | **Falta** → H2 |
| **Listado paginado y con búsqueda** | **No** | Sí, 20 por página | Sí | **Falta** → H3 |
| Dice en qué moneda valora | **No** | — | Sí | **Falta** → H4 |
| Filas agotadas | Se listaban siempre | Tienen estado propio | Se filtran | **A decidir** → ocultarlas |

## 4. Decisiones

Tomadas en sesión autónoma, a petición de Rafael, con el criterio escrito para que pueda
revisarlas.

**Reservado y disponible se calculan, no se denormalizan.** La referencia guarda
`available_quantity` en la fila y la actualiza en cada movimiento; nosotros lo derivamos al
consultar, con el puerto `ExpectedStock` que ya existía, ya tenía contrato y ya alimentaba Bajo
mínimo. Denormalizar añade una segunda verdad que puede separarse de la primera, y el coste que
evita —una consulta agregada por página— no lo justifica con estos volúmenes. Si algún día lo
justifica, la fila derivada se añade sin cambiar lo que la pantalla enseña.

**Disponible es existencia menos reservado, y nunca negativo.** Lo que viene en camino no entra:
eso es una pregunta de reposición y ya la contesta Bajo mínimo con la existencia proyectada.
Mezclarlas haría que «disponible» significara dos cosas distintas en dos pantallas.

**El valor usa los decimales de la empresa**, con la misma aritmética entera que el informe de
valuación, y la pantalla dice en qué moneda.

**Las filas en cero no se listan**, salvo que se pidan con una casilla. Una fila en cero dice por
dónde pasó el artículo alguna vez, no que haya algo; y con paginación, los ceros empujan fuera de
la primera página lo que sí hay.

**El valor total sale de la pantalla.** Sumar sólo lo visible sería mentir, y sumar todo el filtro
duplicaría en el inventario la consulta agregada que el informe de valuación ya hace bien —y que
además se exporta—. La pantalla enlaza al informe.

**El tipo «no inventariado» no se agrega.** Era un tema abierto asignado a este submódulo. La
referencia lo tiene y lo agrupa con servicio: los dos simplemente no llevan existencia. Aquí, un
servicio ya no mueve existencia, así que lo único que aportaría es una etiqueta más honesta para un
bien físico que no se controla —empaques, papelería—. Se comprobó que **ninguna regla del sistema
distingue hoy un bien de un servicio**, ni siquiera las fiscales. Mismo criterio que con los campos
de la bodega en el Catálogo: un campo se añade cuando existe el flujo que lo consume. Anotado en
[FUTURE.md](../../FUTURE.md).

## 5. Los hallazgos

### H1 · ALTA · La pantalla decía cuánto hay, no cuánto se puede prometer

Un vendedor veía **288 unidades de agua** y no sabía que **72 estaban comprometidas** en pedidos
confirmados. El dato existía —`ExpectedStock` lo calculaba para Bajo mínimo desde la fase 4— pero
no llegaba a la pantalla donde se mira antes de prometer.

**Corregido**: tres columnas, existencia, reservado y disponible. Con los datos de demostración la
pantalla ya enseña el caso: 288 · 72 · 216.

### H2 · MEDIA · El mismo inventario valía dos cosas distintas

La pantalla redondeaba a **céntimos fijos**; el informe de valuación, a **los decimales que la
empresa configura**. **Reproducido**: con la empresa a cuatro decimales, tres unidades a 0,12345
valen **0,37 en la pantalla y 0,3704 en el informe**.

Venía de la fase de multimoneda, que hizo los decimales configurables y actualizó el informe pero
no esta pantalla. **Corregido**: la misma aritmética entera, redondeando una sola vez, con los
decimales de la empresa.

### H3 · MEDIA · El listado traía todas las existencias de la empresa

`searchStocks` devolvía cada fila de la empresa y ordenaba en memoria. Mismo defecto que el listado
de Ajustes. **Corregido**: paginación y búsqueda por SKU y por nombre, con el desempate por clave
para que ninguna fila se quede fuera de todas las páginas.

### H4 · BAJA · No decía en qué moneda

El informe lo dice; la pantalla no. **Corregido.**

### H5 · BAJA · Un puerto con dos nombres iguales

Al añadir `search` al repositorio de existencias, el doble de pruebas —que implementa tres puertos
en una clase— dejó de compilar: `AdjustmentRepository` ya tenía `search`. **Corregido** llamándolo
`searchPage`, y anotado: que una clase implemente tres puertos es el olor de fondo, no el nombre.

## 6. Lo que este paso enseñó

1. **Un dato que ya se calcula no está necesariamente donde hace falta.** `ExpectedStock` llevaba
   desde la fase 4 calculando lo reservado, con su contrato y sus pruebas, y sólo lo veía la
   pantalla de reposición. El hallazgo no fue construir nada nuevo: fue darse cuenta de dónde
   faltaba.
2. **Paginar rompe las pruebas que daban por hecho verlo todo, y eso es bueno.** Nueve pruebas de
   extremo a extremo fallaron al paginar: buscaban su artículo en un listado que ahora sólo trae
   veinte filas. Ninguna era un falso positivo; todas describían un hábito que ya no se sostiene.
   Al arreglarlas quedaron diciendo algo más honesto: *busca tu artículo*, en vez de *míralo todo*.
3. **Una regla nueva cambia lo que una prueba vieja significa.** Al esconder las filas en cero, las
   pruebas que comprobaban «vuelve a cero» dejaron de encontrar la fila. La tentación es pedirles
   que vuelvan a verlo todo; lo correcto fue partirlas en dos: que por defecto **desaparezca**, y
   que pidiendo las agotadas **esté en cero**.
4. **Dos cifras para el mismo número siempre terminan separándose.** El valor del inventario se
   calculaba en dos sitios con dos reglas de redondeo, y la fase que hizo los decimales
   configurables sólo arregló uno. Cuando una cifra se pinta en dos pantallas, el mismo código
   tiene que producirla.
