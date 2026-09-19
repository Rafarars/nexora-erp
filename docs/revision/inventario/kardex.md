# Revisión: Inventario › Kardex

**Fecha:** 19-sep-2026 · **Estado:** ✅ cerrado · Cada movimiento de un artículo, en orden
([README](../README.md))

Cuarta revisión con la skill `module-review`, modo **módulo sin revisar**. Cierra Inventario. El
sistema de referencia es `verlumyx/erp`, leído en su código.

---

## 1. Qué hace hoy el sistema

`inventory_movements` es el libro: una fila por movimiento, con su cantidad, su costo unitario y
**el saldo y el promedio que quedaron después**. Nada se edita y nada se borra; una anulación es
otro movimiento que **cita al original** (`reversal_of_id`, único en la base, así que una
contrapartida no se duplica).

Lo que ya estaba bien:

- **`sequence` por artículo y bodega, 1, 2, 3… sin huecos**, y el contrato lo comprueba como
  propiedad contra el doble y contra PostgreSQL, junto con «la existencia es la suma del kardex».
- **Sólo tres documentos escriben aquí**: ajuste, entrada de compra y despacho. El sistema de
  referencia tiene la misma regla y la justifica igual: un documento comercial describe un acuerdo,
  no un hecho físico.
- **El costo promedio se recalcula con enteros escalados**, redondeando una sola vez.
- **Filtrar por un artículo o una bodega de otra empresa responde 404.**

## 2. Qué debería hacer

**El sistema de referencia** (`app/Modules/InventoryMovement/`): su movimiento lleva `code`,
`movement_date`, `total_cost`, `balance_value`, `notes`, `created_by`, `status` y ubicación, lote y
serie. Su listado **pagina** (`limit = 20`) y filtra por **catorce criterios**, entre ellos
`date_from`, `date_to`, `origin_type`, `warehouse_id` y `type`.

**El sector:** el [Stock Ledger de ERPNext](https://docs.frappe.io/erpnext/stock-ledger) «reflects
the quantity and value of stock issued, received, or transferred», y se acota con filtros de
periodo y de tipo de documento.

## 3. Comparar

| Regla | Sistema | Referencia | Sector | Veredicto |
|---|---|---|---|---|
| Nada se borra: la anulación es otro movimiento que cita al original | Sí | Sí | Sí | **Ya correcto** |
| Cada fila lleva su saldo y su promedio posteriores | Sí | Sí | Sí | **Ya correcto** |
| `sequence` por artículo y bodega, sin huecos, probado como propiedad | Sí | No, código global | — | **Mejor que la referencia** |
| Sólo tres documentos escriben en el libro | Sí | Sí, con el mismo razonamiento | Sí | **Ya correcto** |
| Costo promedio con enteros escalados | Sí | **Coma flotante** | — | **Mejor que la referencia** |
| **Paginado** | **No** | Sí, 20 por página | Sí | **Falta** → H1 |
| **Filtro por rango de fechas** | **No** | Sí | Sí | **Falta** → H1 |
| **Filtro por tipo de documento** | **No** | Sí | Sí | **Falta** → H1 |
| Orden de las bodegas | **Por identificador** | Por fecha | — | **Falta** → H2 |
| Método de costo | Sólo promedio | Tres declarados, **FIFO sin implementar** | Tres reales | **A decidir** → promedio |

## 4. Decisiones

Tomadas en sesión autónoma, a petición de Rafael, con el criterio escrito.

**El kardex se lee del más reciente al más antiguo.** Con años de historia, lo que se busca al
abrirlo está al final, no al principio; y cada fila lleva su propio saldo, así que el orden no le
quita sentido a nada. Es lo que hace la referencia y lo que hacen los libros de movimientos de los
ERP. Dentro de cada bodega, para que el saldo de cada una se lea seguido.

**Lo que acota el volumen es el filtro de fechas, no la paginación.** Se construyeron los dos, pero
el que cambia el uso es poder pedir «lo de agosto». Se filtra por **la fecha que el documento
declara**, no por el instante de publicación: es la que alguien tiene en la mano cuando busca.

**El método de costo sigue siendo el promedio ponderado, y sólo ese.** Dos razones, y la segunda
salió de leer el código de la referencia:

1. **FIFO no es un campo, es otro motor**: exige capas con su costo y su cantidad restante,
   consumidas en orden, y una anulación que las *des-consume* en orden inverso.
2. **La referencia declara tres métodos y tiene uno y medio.** Su `cost_method` admite
   `['average', 'fifo', 'standard']`, pero se lee **en exactamente dos sitios**, los dos
   comparándolo con `'standard'`. **`fifo` no ramifica en ninguna parte**: se puede elegir y el
   motor sigue calculando promedio. Ofrecer una opción que no hace lo que promete es peor que no
   ofrecerla —es el mismo caso que su retención en el Catálogo—, así que se descarta por el mismo
   motivo. Alcance en [FUTURE.md](../../FUTURE.md).

**El kardex sigue siendo de un artículo.** No se abre a «qué se movió en esta bodega», que es otro
informe. Anotado.

## 5. Los hallazgos

### H1 · MEDIA · El kardex se devolvía entero, sin filtros

`searchMovements` traía **todos** los movimientos del artículo. Estaba anotado en `FUTURE.md` desde
el H7; esta revisión lo convirtió en decisión. **Corregido**: paginación, y filtros por bodega, por
tipo de documento y por rango de fechas, en la API y en la pantalla, viajando en la dirección.

### H2 · BAJA · Las bodegas se ordenaban por su identificador

`orderBy: [{ warehouseId: 'asc' }]` ordena por UUID, así que el orden de los bloques era arbitrario
para quien mira, y distinto del de Existencias, que ordena por nombre. **Corregido**: por nombre de
bodega en las dos pantallas.

### H3 · BAJA · El kardex usaba el DTO de consulta de Existencias

Compartían `stockQuerySchema`, así que al ampliarlo para Existencias el kardex heredó parámetros que
no significan nada ahí —`includeEmpty`, `q`—. Además, la vigilancia de aislamiento lee el DTO de
cada ruta para saber qué identificadores acepta. **Corregido**: cada ruta con el suyo, que es lo que
ya decía el comentario del DTO de valuación.

### H4 · BAJA · El orden del kardex no estaba escrito en ninguna prueba

Ninguna prueba fallaba si alguien cambiaba el orden: los `data-testid` de la pantalla van por
`sequence`, no por posición, y las pruebas de API comparaban listas cortas donde el orden coincidía
por casualidad. Al invertirlo, **dos pruebas fallaron** y quedó claro cuáles lo daban por hecho sin
decirlo. **Corregido**: ahora lo afirman, y el contrato exige que la primera página traiga los
últimos.

## 6. Lo que este paso enseñó

1. **Leer el código de la referencia también sirve para decidir que NO.** El tema del método de
   costo llevaba abierto desde el principio y parecía una carencia. Bastó buscar dónde se lee su
   `cost_method` —dos sitios, los dos comparando con `'standard'`— para ver que su FIFO es una
   etiqueta. La decisión se tomó en cinco minutos y con argumento.
2. **Un DTO compartido entre dos rutas acopla lo que no tiene por qué.** Ampliar el de Existencias
   le dio al kardex parámetros sin sentido. Que cada ruta tenga el suyo parece duplicación hasta que
   una de las dos crece.
3. **Un orden que nadie afirma es un orden que nadie defiende.** Invertirlo tenía que romper algo, y
   sólo rompió dos comparaciones que coincidían por casualidad. Cuando el orden importa —y en un
   libro importa—, hay que escribirlo en una prueba.
