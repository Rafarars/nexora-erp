# Inventario

**Cuánto** hay de cada artículo en cada bodega, **cuánto vale** y **cómo** se llegó a eso.

Contexto: `apps/api/src/contexts/inventory` · Pantallas: `/inventario/*` · Informe técnico:
[`../H3-INVENTARIO.md`](../H3-INVENTARIO.md)

| Submódulo | Tabla | Prefijo | Qué es |
|---|---|---|---|
| Ajustes | `adjustments`, `adjustment_lines` | `AJU` | Documento que corrige existencias: conteos, mermas, hallazgos |
| Kardex | `inventory_movements` | — | Una fila por cada cambio de existencia, inmutable |
| Existencias | `item_stocks` | — | Saldo actual por artículo y bodega, derivado del kardex |

**Depende de** Catálogo (artículos, unidades, bodegas), que lee por su propio puerto sin importar
el código del catálogo.

---

## Principios

1. **Un solo camino mueve existencia.** En el H3 es el ajuste confirmado o anulado. Entradas (H4) y
   despachos (H5) pasarán por el mismo mecanismo.
2. **El kardex no se edita ni se borra.** Un error se corrige con un movimiento de contrapartida
   que cita al original.
3. **La existencia es derivada.** Siempre es igual a la suma de sus movimientos, y el saldo del
   último movimiento es la existencia. Hay pruebas que lo exigen.
4. **Nunca queda negativa.** Lo impide el dominio, lo impide un bloqueo de filas bajo concurrencia
   y lo impide la base (`CHECK quantity >= 0`).
5. **Cantidades y costos en enteros escalados**: la suma cuadra exacta, sin redondeos de coma
   flotante.

---

## 1. Ajustes

### 1.1 Cabecera — `adjustments`

| Campo | Tipo | Regla |
|---|---|---|
| `code` | `AJU000001` | Asignado al crear |
| `warehouse_id` | bodega | De la empresa y **activa** |
| `adjustment_date` | fecha | Por defecto hoy. **No puede ser futura** |
| `notes` | texto(500) | Opcional |
| `status` | `draft` \| `confirmed` \| `cancelled` | Ver ciclo de vida |
| `confirmed_at`, `cancelled_at` | fecha y hora | Cuándo cambió de estado |

### 1.2 Líneas — `adjustment_lines`

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

### 1.3 Ciclo de vida

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

1. **Se revalida el borrador con el catálogo de hoy**: si el artículo se desactivó, se rechaza;
   si su caja pasó de 24 a 12, las cantidades base se recalculan con 12.
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

## 2. Kardex — `inventory_movements`

| Campo | Qué es |
|---|---|
| `sequence` | Número del movimiento dentro de su artículo y bodega: 1, 2, 3… sin huecos |
| `direction`, `quantity` | Entrada o salida, siempre positiva, en unidad base |
| `unit_cost` | Costo por unidad base del movimiento |
| `balance_quantity` | Existencia **después** del movimiento |
| `balance_average_cost` | Costo promedio **después** del movimiento |
| `origin_type`, `origin_id`, `origin_line_id` | Documento y línea que lo originaron (`adjustment`) |
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

## 3. Existencias — `item_stocks`

| Campo | Qué es |
|---|---|
| `item_id`, `warehouse_id` | Clave, junto con la empresa |
| `quantity` | Existencia en unidad base, **nunca negativa** |
| `average_cost` | Costo promedio vigente |
| `last_sequence` | Último número de movimiento |

**Solo la escribe quien escribe el kardex**, en la misma transacción. La valoración de la pantalla
es `cantidad × costo promedio`, redondeada a céntimos.

---

## 4. Concurrencia

Confirmar o anular ocurre en **una transacción** que:

1. **Bloquea la fila del ajuste**: dos confirmaciones del mismo ajuste esperan en fila y la segunda
   lo ve confirmado.
2. **Crea las existencias que falten y las bloquea en un orden fijo**: dos ajustes que sacan el
   mismo artículo esperan en fila y el segundo ve el saldo que dejó el primero; el orden fijo evita
   bloqueos mutuos.
3. Ejecuta las reglas del dominio y escribe ajuste, movimientos y existencias juntos.

Probado contra PostgreSQL: dos salidas de 6 sobre 10 enviadas a la vez → pasa una y queda 4.

---

## 5. Reglas que el inventario impone al catálogo

| Regla | Error |
|---|---|
| No se desactiva un artículo con existencia | `ItemWithStockError` |
| No se desactiva una bodega con existencia | `WarehouseWithStockError` |
| No cambia la unidad base ni el tipo de un artículo con movimientos | `ItemWithMovementsError` |

---

## 6. API y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Listar ajustes | `GET /api/v1/inventory/adjustments` | `inventory.adjustments.search` |
| Crear borrador | `POST /api/v1/inventory/adjustments` | `inventory.adjustments.create` |
| Editar borrador | `PUT /api/v1/inventory/adjustments/:adjustmentId` | `inventory.adjustments.update` |
| Confirmar | `PUT /api/v1/inventory/adjustments/:adjustmentId/confirm` | `inventory.adjustments.confirm` |
| Anular | `PUT /api/v1/inventory/adjustments/:adjustmentId/cancel` | `inventory.adjustments.cancel` |
| Existencias | `GET /api/v1/inventory/stock?warehouseId=` | `inventory.stock.search` |
| Kardex | `GET /api/v1/inventory/items/:itemId/movements?warehouseId=` | `inventory.movements.search` |

- Filtrar por **una bodega o un artículo de otra empresa responde 404**, no una lista vacía.
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

## 7. Pantallas

| Ruta | Qué hace |
|---|---|
| `/inventario` | Redirige a la primera sección que el rol puede ver |
| `/inventario/existencias` | Artículo, bodega, existencia en unidad base, costo promedio, valor y total; filtro por bodega en la dirección |
| `/inventario/ajustes` | Código, fecha, bodega, resumen de líneas («+2 cja (48 un) AGUA-500»), estado y Opciones según el estado |
| `/inventario/kardex` | Elige artículo y bodega; cada movimiento con documento, cantidad, costo, saldo y promedio, y las anulaciones marcadas |

- El formulario de ajustes se ofrece solo si el rol puede leer artículos y bodegas del catálogo.
- En cada línea: al elegir un artículo se propone su unidad base; el costo solo se habilita en
  entradas.
- Confirmar y anular muestran el error traducido encima de la tabla («No hay existencia suficiente
  para esta salida.»).

---

## 8. Datos de demostración

| Empresa | Ajuste | Estado | Contenido | Existencia resultante |
|---|---|---|---|---|
| Acme | `AJU000001` | Confirmado | 10 cajas de agua a 12; 50 kg de detergente a 3,20 | Agua 240 un a 0,50; detergente 50 kg a 3,20 (Principal) |
| Acme | `AJU000002` | Borrador | Salida de 6 un de agua («Merma por rotura») | — |
| Globex | `AJU000001` | Confirmado | 30 filtros a 8,50 | Filtro 30 un (Central) |
| Globex | `AJU000002` | Borrador | Salida de 2 filtros | — |

Se rehace entero en cada corrida de semillas.

---

## 9. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio | `contexts/inventory/domain/**/*.spec.ts` | Aritmética exacta, costo promedio, reversiones, «existencia = suma del kardex», ciclo del ajuste, fábrica de líneas |
| Aplicación | `adjustment-lifecycle.spec.ts` | Crear, editar, confirmar con catálogo de hoy, anular, consultar, aislamiento |
| Contrato | `inventory-ports.contract.ts` | 19 casos contra doble y PostgreSQL: atomicidad, 2 salidas simultáneas, doble confirmación, 12 ajustes concurrentes con la propiedad del kardex intacta |
| API | `tests/api/inventory.api.spec.ts` | Todo lo anterior por HTTP, con un artículo propio por prueba |
| Interfaz | `tests/ui/inventory.spec.ts` | Recorrido ajuste → existencias → kardex → anulación; guarda en cero en español; solo lectura |
| Aislamiento | `tests/isolation/*` | 6 ataques: editar, confirmar o anular ajustes de Globex, crear en su bodega, leer su kardex o filtrar por su bodega |
