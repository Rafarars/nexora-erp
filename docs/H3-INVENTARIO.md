# H3 — Inventario: informe de las fases 0 a 6

Hecho de corrido, **sin commitear**, con la misma dinámica del H2: cada fase completa, revisión
rigurosa del código, del sistema y de las pruebas, y este informe para que Rafael lo revise antes
de repartirlo en commits.

**Supuestos de diseño** tomados sin preguntar (se cambian en la revisión si alguno no convence):
contexto propio que no importa el catálogo, ajustes como documento borrador → confirmado →
anulado, kardex inmutable con contrapartida, existencias derivadas que nunca bajan de cero, costo
promedio ponderado y cantidades en enteros escalados.

---

## Fase 0 — Modelo y migración

**Migración:** `20260913144003_create_inventory_context`.

| Tabla | Para qué |
|---|---|
| `adjustments` | El documento: bodega, fecha, notas y estado (`draft`, `confirmed`, `cancelled`) |
| `adjustment_lines` | Cada línea: artículo, unidad, entrada o salida, cantidad, cantidad base y costo |
| `inventory_movements` | El kardex: una fila por cambio de existencia, con el saldo después |
| `item_stocks` | La existencia de cada artículo en cada bodega y su costo promedio |

**Decisiones.**

- **La base prohíbe una existencia negativa** (`CHECK quantity >= 0`), además del dominio.
- Claves ajenas **compuestas con la empresa** hacia artículos, unidades y bodegas, como en el catálogo.
- `sequence` numera los movimientos de un artículo en una bodega (`unique`), para ordenar el
  kardex sin depender de la hora. `balance_*` guarda el saldo después de cada movimiento: el
  kardex se audita sin recalcular.
- `reversal_of_id` es **único**: un movimiento se revierte una sola vez. La clave es `RESTRICT`: no
  se puede borrar un movimiento que otro revierte.

---

## Fase 1 — Dominio

`apps/api/src/contexts/inventory/domain/`.

| Pieza | Qué es |
|---|---|
| `quantity/` | `Quantity` en diezmilésimas y `UnitCost` en millonésimas, con `BigInt` |
| `stock/item-stock.entity.ts` | La existencia: `receive`, `release` y `reverse`; cada uno devuelve el movimiento que lo explica |
| `movement/` | `InventoryMovement`, sin ningún método que lo cambie |
| `adjustment/` | El agregado `Adjustment`, sus líneas, la fecha y su ciclo de vida |
| `adjustment/lines/` | `AdjustmentLineFactory`: valida contra el catálogo y convierte a unidad base |
| `adjustment/posting/` | El puerto `AdjustmentPosting` y los servicios puros `AdjustmentConfirmation` y `AdjustmentCancellation` |
| `catalog/inventory-catalog.ts` | El puerto con el que el inventario lee artículos y bodegas **sin importar el catálogo** |

**Reglas** (cada una con su prueba):

- **No se saca lo que no hay**, ni al confirmar ni al anular una entrada cuya mercancía ya salió.
- **Costo promedio ponderado**: 10 a 2 y 30 a 4 dejan 40 a 3,5. Una salida se valora al
  promedio vigente y no lo cambia. Revertir una entrada saca su valor del promedio.
- Una línea usa una unidad **del artículo**; su cantidad base se calcula con el factor. El costo
  es **por unidad de la línea**: una caja de 24 a 12 entra a 0,5 por unidad.
- Solo las entradas llevan costo; una entrada sin costo se valora al promedio vigente.
- **Los servicios no tienen existencia.** Artículo y bodega activos y de la empresa.
- Un ajuste tiene al menos una línea, **no se fecha en el futuro**, se edita solo en borrador,
  se confirma una vez y se anula una vez.

**Decisiones.**

- **Enteros escalados.** Con coma flotante, 0,1 + 0,2 no es 0,3, y «la existencia es la suma
  del kardex» dejaría de ser verdad por redondeo. Con enteros cuadra exacto; hay una prueba que
  lo comprueba sobre una secuencia larga con decimales.
- **`AdjustmentPosting` es el único camino** para mover existencia. El trabajo que recibe es
  síncrono y puro: si lanza un error de dominio, no se escribe nada.

---

## Fase 2 — Aplicación

| Caso de uso | Qué hace |
|---|---|
| `AdjustmentCreator` / `AdjustmentUpdater` | Borrador nuevo o reemplazado entero |
| `AdjustmentConfirmer` | **Revalida el borrador con el catálogo de hoy** y lo publica |
| `AdjustmentCanceller` | Anula por la publicación, también un borrador, para serializar |
| `AdjustmentSearcher`, `StockSearcher`, `MovementSearcher` | Listados con los nombres del catálogo resueltos |

**Reglas del H2 que esperaban al inventario** (en el catálogo, con su puerto `StockUsage`):

- No se desactiva un artículo **con existencia** ni una bodega **con existencia**.
- **No cambia la unidad base ni el tipo** de un artículo con movimientos: el kardex guarda
  cantidades en esa unidad, y cambiarla reescribiría su historia.

**Decisiones.**

- Confirmar recalcula las cantidades base: si la caja pasó de 24 a 12 desde que se escribió el
  borrador, se confirma con 12. Si el artículo se desactivó, se rechaza.
- Filtrar existencias o kardex por **una bodega o un artículo de otra empresa responde 404**,
  como en el resto del sistema, y no una lista vacía.

---

## Fase 3 — Infraestructura y contrato de puerto

| Archivo | Qué hace |
|---|---|
| `prisma-adjustment-posting.ts` | La transacción: bloquea el ajuste y sus existencias, ejecuta el dominio y escribe todo junto |
| `prisma-adjustment.repository.ts` | Guarda borradores **solo si siguen en borrador** |
| `prisma-inventory-catalog.ts` | Capa anticorrupción: lee las tablas del catálogo con el vocabulario del inventario |
| `prisma-stock-usage.ts` (catálogo) | El catálogo pregunta al inventario leyendo sus tablas |
| `testing/inventory-ports.contract.ts` | 19 casos contra el doble y contra PostgreSQL |

**Cómo se serializa.** `SELECT … FOR UPDATE` sobre el ajuste (dos confirmaciones del mismo
ajuste esperan en fila) y sobre cada existencia **en un orden fijo** (dos ajustes con los mismos
artículos no se bloquean mutuamente). Las existencias que faltan se crean con `ON CONFLICT DO
NOTHING` antes de bloquearlas, y si el dominio falla se revierten también.

**Lo que el contrato comprueba contra PostgreSQL con bloqueos de verdad:** dos salidas de 6
sobre 10 enviadas a la vez (pasa una), la misma confirmación pedida dos veces a la vez (pasa
una), doce ajustes concurrentes con la propiedad «existencia = suma del kardex» intacta, que un
fallo no deja **ni la fila de existencia** creada para bloquearla, y que un borrador leído antes
de una confirmación no puede devolver el ajuste a borrador.

---

## Fase 4 — API, permisos y aislamiento

| Ruta | Permiso |
|---|---|
| `GET /inventory/adjustments` | `inventory.adjustments.search` |
| `POST /inventory/adjustments` | `inventory.adjustments.create` |
| `PUT /inventory/adjustments/:id` | `inventory.adjustments.update` |
| `PUT /inventory/adjustments/:id/confirm` | `inventory.adjustments.confirm` |
| `PUT /inventory/adjustments/:id/cancel` | `inventory.adjustments.cancel` |
| `GET /inventory/stock?warehouseId=` | `inventory.stock.search` |
| `GET /inventory/items/:itemId/movements?warehouseId=` | `inventory.movements.search` |

**Seis ataques nuevos** en la matriz de aislamiento (doce con los dos atacantes), y la foto de
Globex incluye ahora sus ajustes y existencias: confirmar el borrador de Globex, anular su ajuste
confirmado o leer su kardex responden 404 y Globex queda idéntica.

---

## Fase 5 — Frontend

Módulo «Inventario» en la barra lateral, con tres secciones.

| Pantalla | Qué hace |
|---|---|
| Existencias | Por bodega, en unidad base, con costo promedio, valor y total; filtro por bodega en la dirección |
| Ajustes | Listado con menú Opciones (Editar, Confirmar, Anular) y panel con editor de líneas |
| Kardex | Elige artículo y bodega; cada movimiento con su documento, su saldo y las anulaciones marcadas |

- `modules/inventory/` sin React: modelo, puerto, acciones disponibles por estado, resumen de
  líneas, formato de cantidades y costos, y la traducción de errores, que delega en las del
  catálogo y el acceso.
- `SectionNav` reemplaza al menú propio del catálogo: los dos módulos usan el mismo.

---

## Fase 6 — Semillas y pruebas end-to-end

**Semillas.** Acme: `AJU000001` confirmado (10 cajas de agua a 12 y 50 kg de detergente a 3,20)
y `AJU000002` en borrador (merma de 6 unidades). Globex: su `AJU000001` confirmado y un borrador.
Movimientos y existencias escritos como los escribiría el sistema. **Se rehacen enteros en cada
corrida**, porque las pruebas confirman y anulan.

**Pruebas nuevas.**

| Archivo | Qué cubre |
|---|---|
| `tests/api/inventory.api.spec.ts` | Borrador sin efecto, confirmación en unidad base y costo, guarda en cero, anulación con contrapartida, **dos salidas simultáneas**, borrador no editable, líneas inválidas, reglas del catálogo con existencia y permisos |
| `tests/ui/inventory.spec.ts` | El recorrido completo desde la pantalla, la guarda en cero explicada en español y el rol de solo lectura |
| `support/inventory-fixtures.ts` | **Un artículo propio por prueba**: el stock es estado compartido y las pruebas corren en paralelo |

---

## Revisión posterior

| Hallazgo | Arreglo |
|---|---|
| **Carrera**: editar un borrador mientras otro lo confirma lo devolvía a borrador | El repositorio actualiza solo filas en borrador y responde 409 |
| El kardex de un artículo ajeno devolvía una lista vacía en vez de 404 | 404, igual que la existencia filtrada por bodega ajena |
| El vigilante de aislamiento marcó `GET /inventory/stock` | No era un falso positivo: el filtro no se comprobaba. Ahora responde 404 y tiene su ataque |
| Desactivar la bodega por defecto con existencia decía «tiene existencia» | La regla de la propia bodega va primero |
| El formulario mostraba el costo con cuatro decimales y admite seis | `formatCost` con seis |
| `AdjustmentCreator` pedía dos identificadores para un ajuste | Uno |
| **Defecto latente del H2**: el contrato de `access`, corrido solo, fallaba al borrar empresas con catálogo sembrado (`item_units_tenant_id_unit_id_fkey`). Pasaba porque otro contrato vaciaba esas tablas antes | El arnés de `access` vacía inventario y catálogo antes de borrar empresas. Se comprobó corriéndolo solo sobre la base sembrada |

---

## Validación

`make verify` completo en verde:

| Nivel | Antes del H3 | Ahora |
|---|---|---|
| Unitarias de la API | 1023 | **1249** |
| Unitarias del frontend | 62 | **82** |
| Contrato de puerto (PostgreSQL) | 67 | **82** |
| End-to-end | 153 | **177** |

Antes de las pruebas end-to-end se recorrió la API a mano con `curl`: existencias, kardex,
confirmar la merma sembrada (240 → 234), servicio rechazado, artículo con existencia no
desactivable, unidad base con movimientos no modificable, kardex y bodega ajenos (404) y rol de
solo lectura (403).

---

## Qué falta para cerrar el H3

- Revisión de Rafael y commits por fase.
- Entradas y despachos, que también moverán existencia, llegan con compras (H4) y ventas (H5):
  reutilizarán `ItemStock` y generalizarán `AdjustmentPosting`.
