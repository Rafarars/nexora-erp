# Revisión: Catálogo

**Fecha:** 18-sep-2026 · **Estado:** ✅ cerrado · Unidades de medida, categorías, impuestos y bodegas
([README](../README.md))

Las listas de precio, el quinto maestro del módulo, se revisaron en la fase 5 de Artículos
([temas/listas-de-precio.md](../temas/listas-de-precio.md)) y no se repiten aquí.

Es la primera revisión hecha con la skill `module-review` ya corregida, en modo **módulo sin
revisar**: etapa 2 completa y comparación regla por regla.

---

## 1. Qué hace hoy el sistema

Los cuatro maestros comparten forma: código correlativo asignado por el sistema, nombre único por
empresa, nada se borra, y el listado devuelve activos e inactivos.

| Maestro | Campos propios | Qué lo protege al desactivar |
|---|---|---|
| Categorías | nombre, descripción | Ningún artículo **activo** la usa |
| Unidades | nombre, abreviatura sin espacios | Ningún artículo activo la usa, como base o secundaria |
| Impuestos | nombre, tasa `decimal(7,4)` entre 0 y 100 | Ningún artículo activo la usa, para vender **o** para comprar |
| Bodegas | nombre, dirección, marca de por defecto | No ser la de por defecto, y no tener existencia |

**La unicidad está en dos capas en los cuatro**: comprobación previa en el caso de uso e índice
único en la base, con la violación traducida a conflicto. La bodega por defecto, además, tiene un
**índice único parcial** (`WHERE is_default`) que impide que dos queden marcadas bajo concurrencia.

## 2. Qué debería hacer

**El sistema de referencia** (`verlumyx/erp`), leyendo su código:

- **Unidades y categorías**: no impide desactivarlas en uso. Su `UpdateStatusService` no comprueba
  nada. Nosotros sí.
- **Impuestos**: sí lo impide, y mirando venta y compra, igual que nosotros.
- **Bodegas**: comprueba existencia **y documentos abiertos** (`hasOpenDocuments`, con borrador,
  confirmado y parcial). Nosotros solo la existencia.
- **Bodega por defecto**: la garantiza por aplicación —limpia la anterior y marca la nueva en una
  transacción—, sin restricción en el esquema. Nosotros tenemos el índice parcial.
- **Categorías**: también planas, con un campo de orden manual.
- **Impuestos**: añade retención (`has_withholding`, `withholding_percentage`).
- **Bodegas**: añade tipo, responsable, «permite existencia negativa», «usa ubicaciones» y
  «disponible para ventas».

**El sector:**

- Odoo y ERPNext usan **jerarquía de categorías**; ERPNext con un árbol de grupos de artículo.
- ERPNext marca las unidades que **no admiten fracciones** (*must be whole number*): un televisor no
  se vende en 1,5 unidades.
- Archivar una ubicación con existencia o movimientos asociados es algo que en Odoo resuelve un
  módulo de la comunidad (`stock_archive_constraint`): el núcleo no lo impide, pero el sector lo
  considera necesario.

## 3. Comparar

| Regla | Sistema | Referencia | Sector | Veredicto |
|---|---|---|---|---|
| Nada se borra, todo se desactiva | Sí | Sí | Sí | **Ya correcto** |
| Nombre único por empresa, en dos capas | Sí | Sí (una capa) | Sí | **Ya correcto** |
| Unidad y categoría protegidas en uso | Sí | **No** | Sí | **Ya correcto** |
| Impuesto protegido, venta y compra | Sí | Sí | Sí | **Ya correcto** |
| Tasa congelada en el documento emitido | Sí | Sí | Sí | **Ya correcto** |
| Una sola bodega por defecto, garantizada por la base | Sí | Solo por aplicación | — | **Ya correcto** |
| Bodega protegida con documentos abiertos | **No** | **Sí** | Sí | **Falta** → H1 |
| Unidad que no admite fracciones | **No** | No | **Sí** (ERPNext) | **Del sector** → H2 |
| Jerarquía de categorías | No | No | Sí | **A decidir** → plana |
| Retención en el impuesto | No | Sí, a medias | Norma venezolana | **A decidir** → hito propio |
| Campos extra de bodega | No | Sí | — | **A decidir** → ninguno |

## 4. Decisiones de Rafael

**Las categorías siguen planas**, y queda escrito el porqué con las fuentes comparadas: una
jerarquía obliga a cada filtro y cada informe a decidir si acumula, hay que impedir ciclos y acotar
la profundidad, y para un catálogo de este tamaño cuesta más de lo que da. Coincide con la
referencia; se descarta lo que hacen Odoo y ERPNext, y se descarta también el campo de orden manual.

**La unidad gana la marca de «no admite decimales»**, como ERPNext.

**La retención se construye, pero completa y como hito propio.** Se descartó replicar el campo del
sistema de referencia: leyendo su código, su retención no descuenta del total, no descuenta del
saldo y no emite comprobante, así que sería añadir un dato que nadie consume, y además en el sitio
equivocado —la retención depende de quién compra, no del impuesto—. El alcance está en
[FUTURE.md](../../FUTURE.md).

**Ningún campo nuevo en la bodega.** El análisis de la referencia, campo por campo y mirando quién
los *lee*:

| Campo suyo | Veredicto |
|---|---|
| `allows_negative_stock` | **Consumido**: gobierna el único punto que escribe existencia |
| `uses_locations` | **Consumido**: gobierna todo el módulo de ubicaciones internas |
| `type` | **A medias**: solo «cuarentena» sostiene una regla (devolución dañada); los otros cuatro son etiquetas |
| `is_sales_available` | **Dato muerto**: los selectores filtran solo por activa |
| `responsible_user_id` | **Dato muerto**: solo se muestra |

Los dos que sí consume sostienen cosas que este ERP no tiene —existencia negativa, que aquí se
prohíbe en el dominio, en la base y bajo concurrencia; y ubicaciones internas—. Un campo se añade
cuando existe el flujo que lo consume, no porque otro sistema lo tenga.

## 5. Los hallazgos

### H1 · ALTA · Desactivar una bodega no mira los documentos abiertos

Solo comprobaba que no fuera la de por defecto y que no tuviera existencia. **Reproducido contra la
API local**: bodega nueva y vacía, orden de compra confirmada con 100 unidades en camino, se
desactiva la bodega (**200, aceptado**) y al recibir la mercancía responde **409
`InactivePurchaseWarehouseError`**. La orden queda viva y sin destino.

Es el mismo hueco que Artículos tenía en la fase 1, en otro maestro — y el sistema de referencia sí
lo previene. Reversible reactivando la bodega, pero el sistema dejaba crear el estado inconsistente.

**Corregido**: el puerto `StockUsage` gana `warehouseHasOpenDocuments`, que mira órdenes de compra y
pedidos de venta confirmados o a medias. Los borradores no cuentan, igual que con el artículo.

### H2 · MEDIA · Ninguna unidad podía exigir cantidades enteras

Se podían vender 2,5 televisores. **Corregido**: `must_be_whole` en la unidad, respetado por ajustes,
órdenes de compra y pedidos de venta. En los datos de demostración, la unidad y la caja pasan a ser
enteras; el kilogramo sigue admitiendo decimales.

### H3 · MEDIA · El puerto que protege la bodega no tenía contrato

`StockUsage` no estaba en el contrato del catálogo: su consulta **nunca se había probado contra
PostgreSQL**. **Corregido**: entra al contrato con cinco casos, sembrando órdenes y pedidos reales.

Y al entrar, el contrato hizo su trabajo: **el doble en memoria no filtraba por empresa**, así que
daba por buena una consulta cruzada que PostgreSQL rechaza. Es el falso verde inverso al de la fase
4 —allí el doble era más determinista que la base; aquí, más permisivo—. Corregido también.

### H4 · BAJA · Dos rechazos de bodega se veían con el mensaje genérico

`WarehouseWithStockError` estaba traducido en Inventario, pero la pantalla de bodegas usa el
traductor del Catálogo, donde no existía. **Corregido**, junto con el mensaje del hallazgo H1.

## 6. Lo que este paso enseñó

1. **El mismo hueco aparece en maestros distintos.** Proteger el artículo con documentos abiertos no
   protegió la bodega: cada maestro necesita su propia pregunta. Al revisar un maestro nuevo, la
   primera pregunta útil es *¿qué le pasa a lo que ya lo usa cuando este maestro se cierra?*
2. **Un puerto sin contrato es un adaptador sin probar**, por pequeño que parezca. `StockUsage`
   tenía un solo método y dos defectos: ninguna prueba contra la base, y un doble que mentía sobre
   el aislamiento.
3. **Comparar campo por campo quién los lee**, no quién los escribe. Tres de los cinco campos de
   bodega de la referencia resultaron ser datos muertos o casi, y eso convirtió una pregunta de
   alcance en una decisión fácil.
