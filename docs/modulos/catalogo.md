# Catálogo

Los maestros que alimentan al resto del sistema: **qué** se compra, se vende y se guarda, en
**qué unidades**, con **qué impuesto** y **dónde**.

Contexto: `apps/api/src/contexts/catalog` · Pantallas: `/catalogo/*` · Informe técnico:
[`../H2-CATALOGO.md`](../H2-CATALOGO.md)

| Submódulo | Tabla | Prefijo | Usado por |
|---|---|---|---|
| Categorías | `categories` | `CAT` | Artículos |
| Unidades de medida | `measurement_units` | `UOM` | Artículos, ajustes |
| Impuestos | `taxes` | `IMP` | Artículos (y documentos de venta y compra) |
| Bodegas | `warehouses` | `BOD` | Inventario |
| Artículos | `items`, `item_units` | `ART` | Inventario, compras, ventas |

Todas las tablas llevan `id`, `tenant_id`, `code`, `is_active`, `created_at` y `updated_at`.

---

## Reglas comunes a los cinco maestros

- **Nada se borra**: se desactivan y se reactivan.
- **Código legible** asignado por el sistema al crear; nunca cambia.
- **Nombre único por empresa** (exacto, tras quitar espacios). Dos empresas pueden repetirlo.
- Los listados devuelven **activos e inactivos**, ordenados por nombre; los selectores de otras
  pantallas ofrecen solo los activos, **más el que el registro ya tenía** aunque se haya
  desactivado después.
- Si dos altas simultáneas con el mismo nombre pasan la comprobación previa, la base rechaza la
  segunda y la respuesta es **409, no 500**.

---

## 1. Categorías

Clasificación de los artículos. **Un solo nivel**: no hay subcategorías.

| Campo | Tipo | Regla |
|---|---|---|
| `name` | texto(150) | Obligatorio, único por empresa |
| `description` | texto(1000) | Opcional; vacío se guarda como nulo |

**Reglas**

- **No se desactiva una categoría que usa algún artículo activo** (`CategoryInUseError`). Un
  artículo inactivo no bloquea.

---

## 2. Unidades de medida

Unidad, Caja, Kilogramo. **La unidad no guarda factor de conversión**: cuántas unidades trae
una caja depende del artículo, y se define en cada uno.

| Campo | Tipo | Regla |
|---|---|---|
| `name` | texto(100) | Obligatorio, único por empresa |
| `abbreviation` | texto(10) | Obligatoria, única por empresa, **sin espacios** (se imprime pegada a la cantidad: «12 cja») |

**Reglas**

- **No se desactiva una unidad que usa algún artículo activo**, sea como base o como secundaria
  (`MeasurementUnitInUseError`).

---

## 3. Impuestos

| Campo | Tipo | Regla |
|---|---|---|
| `name` | texto(100) | Obligatorio, único por empresa |
| `rate` | decimal(7,4) | Entre **0 y 100**, hasta 4 decimales. 16 es el 16 % |

**Reglas**

- Un porcentaje de **0** es válido y sirve para los artículos exentos.
- **Cambiar el porcentaje es legítimo**: los documentos copiarán el vigente al confirmarse, así
  que lo ya emitido no se recalcula.
- **No se desactiva un impuesto que usa algún artículo activo** (`TaxInUseError`).
- La base también exige el rango (`CHECK`).

---

## 4. Bodegas

Donde se guarda la existencia.

| Campo | Tipo | Regla |
|---|---|---|
| `name` | texto(150) | Obligatorio, único por empresa |
| `address` | texto(500) | Opcional |
| `is_default` | sí/no | **Exactamente una por empresa** en cuanto hay alguna |

**Reglas**

- **La primera bodega de una empresa es la de por defecto**, sin que nadie lo marque.
- **Elegir otra por defecto** es una acción propia (`PUT /warehouses/:id/default`): le quita la
  marca a la anterior en la misma escritura. Nunca hay dos ni ninguna.
- **No se desactiva la bodega por defecto** (`DefaultWarehouseDeactivationError`): primero se elige
  otra. Esta regla se comprueba antes que la de existencia.
- **Una bodega inactiva no puede ser la de por defecto** (`InactiveDefaultWarehouseError`).
- **No se desactiva una bodega con existencia** (`WarehouseWithStockError`, desde el H3).
- Si dos personas eligen a la vez bodegas por defecto distintas, un índice único parcial en la base
  deja pasar una y la otra recibe `ConcurrentDefaultWarehouseError` (409).

---

## 5. Artículos

El maestro de productos y servicios.

| Campo | Tipo | Regla |
|---|---|---|
| `sku` | texto(60) | Obligatorio, único por empresa. **Se guarda en mayúsculas**; solo letras, dígitos, `.`, `-` y `_` |
| `name` | texto(200) | Obligatorio |
| `description` | texto(1000) | Opcional |
| `type` | `inventoried` \| `service` | Inventariado tiene existencia; servicio se compra y vende pero nunca tiene stock |
| `category_id` | categoría | Opcional |
| `tax_id` | impuesto | Opcional |

### 5.1 Unidades del artículo — `item_units`

| Campo | Tipo | Regla |
|---|---|---|
| `unit_id` | unidad | De la misma empresa |
| `conversion_factor` | decimal(18,4) | Mayor que cero. Cuántas unidades base contiene 1 de esta unidad |
| `is_base` | sí/no | **Exactamente una** base, con factor 1 |

Ejemplo: agua con base «un» y «cja» con factor 24 → 1 cja = 24 un. Todo el stock se guarda en la
unidad base.

**Reglas**

- Al menos una unidad, **exactamente una base con factor 1** y **ninguna repetida**
  (`InvalidItemUnitsError`). El factor puede ser menor que 1 (medio kilo).
- **Todo lo que referencia existe en su empresa y está activo** al crear. Al **editar** se tolera
  conservar una referencia que se desactivó después: corregir la descripción no obliga a cambiar
  la categoría.
- **Reactivar** un artículo exige que sus referencias estén activas, o volvería a los selectores
  con algo que ya no se ofrece.
- **No se desactiva un artículo con existencia** (`ItemWithStockError`, desde el H3).
- **Con movimientos de inventario, no cambia su unidad base ni su tipo** (`ItemWithMovementsError`,
  desde el H3): el kardex guarda cantidades en esa unidad. Sí se pueden añadir unidades
  secundarias o cambiar nombre, categoría e impuesto.

---

## 6. API y permisos

| Recurso | Listar | Crear | Editar | Desactivar/reactivar |
|---|---|---|---|---|
| Categorías | `GET /api/v1/catalog/categories` | `POST` | `PUT /:categoryId` | `PUT /:categoryId/status` |
| Unidades | `GET /api/v1/catalog/units` | `POST` | `PUT /:unitId` | `PUT /:unitId/status` |
| Impuestos | `GET /api/v1/catalog/taxes` | `POST` | `PUT /:taxId` | `PUT /:taxId/status` |
| Bodegas | `GET /api/v1/catalog/warehouses` | `POST` | `PUT /:warehouseId` | `PUT /:warehouseId/status` |
| Artículos | `GET /api/v1/catalog/items` | `POST` | `PUT /:itemId` | `PUT /:itemId/status` |

Más `PUT /api/v1/catalog/warehouses/:warehouseId/default` para elegir la bodega por defecto.

**Permisos** (`catalog.{recurso}.{acción}`), con `{recurso}` = `categories`, `units`, `taxes`,
`warehouses`, `items`:

| Acción | Permite |
|---|---|
| `search` | Listar |
| `create` | Crear |
| `update` | Editar (y, en bodegas, elegir la de por defecto) |
| `deactivate` | Desactivar y reactivar |

El listado de artículos devuelve los **nombres** de categoría, impuesto y unidades: se ve la tabla
de artículos sin permiso para leer esos otros maestros.

---

## 7. Pantallas

| Ruta | Qué hace |
|---|---|
| `/catalogo` | Redirige a la primera sección que el rol puede ver |
| `/catalogo/articulos` | Tabla con SKU, tipo, categoría, impuesto y unidades («un · 1 cja = 24 un»); panel con editor de unidades |
| `/catalogo/categorias` | Nombre y descripción |
| `/catalogo/unidades` | Nombre y abreviatura |
| `/catalogo/impuestos` | Nombre y porcentaje, con coma decimal |
| `/catalogo/bodegas` | Nombre, dirección y marca «Por defecto»; opción «Marcar por defecto» |

- Todas comparten la misma tabla: código, columnas propias, estado y menú **Opciones** (Editar,
  Desactivar o Reactivar). Crear y editar abren el mismo panel lateral.
- El módulo aparece en la barra lateral **solo si el rol puede ver alguna sección**; cada sección,
  solo si puede consultarla.
- El formulario de artículos se ofrece solo si el rol puede leer categorías, impuestos y unidades.
- En el editor de unidades, **la primera unidad elegida queda como base**, y la marca sigue a la
  unidad si se cambia la de su fila.

---

## 8. Datos de demostración

| Empresa | Unidades | Categorías | Impuestos | Bodegas | Artículos |
|---|---|---|---|---|---|
| Acme | Unidad, Caja, Kilogramo | Bebidas, Limpieza | IVA 16 %, Exento | Principal (defecto), Norte | Agua mineral 500 ml (caja de 24), Detergente 1 kg, Servicio de entrega |
| Globex | Unidad, Caja, Kilogramo | Repuestos | IVA 16 % | Central (defecto) | Filtro de aceite |
| Initech | Unidad | — | — | Principal (defecto), Secundaria | — |

---

## 9. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio y aplicación | `contexts/catalog/**/*.spec.ts` | Cada regla anterior, sin base de datos |
| Contrato | `catalog-repositories.contract.ts` | 34 casos contra doble y PostgreSQL: unicidad, código, contador con 20 peticiones simultáneas, bodega por defecto, unidades con factores decimales |
| API | `tests/api/catalog.api.spec.ts` | Reglas por HTTP, 8 altas simultáneas con códigos distintos, permisos |
| Interfaz | `tests/ui/catalog.spec.ts` | Recorrido categoría → artículo → categoría protegida; errores en español; solo lectura; rol sin permisos |
| Aislamiento | `tests/isolation/*` | 12 ataques contra el catálogo de Globex |
