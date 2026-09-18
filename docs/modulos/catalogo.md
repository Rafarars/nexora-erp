# Catálogo

Los maestros que comparten los artículos y los documentos: **en qué unidades** se cuenta, **cómo**
se clasifica, **con qué impuesto** y **dónde** se guarda. Los artículos viven en
[Inventario](inventario.md#1-artículos) desde la revisión de septiembre de 2026, como en los ERP.

Contexto: `apps/api/src/contexts/catalog` · Pantallas: `/catalogo/*` · Informe técnico:
[`../H2-CATALOGO.md`](../H2-CATALOGO.md)

| Submódulo | Tabla | Prefijo | Usado por |
|---|---|---|---|
| Categorías | `categories` | `CAT` | Artículos |
| Unidades de medida | `measurement_units` | `UOM` | Artículos, ajustes |
| Impuestos | `taxes` | `IMP` | Artículos (y documentos de venta y compra) |
| Bodegas | `warehouses` | `BOD` | Inventario |

Todas las tablas llevan `id`, `tenant_id`, `code`, `is_active`, `created_at` y `updated_at`.

---

## Reglas comunes a los cuatro maestros

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
- **No se desactiva un impuesto que usa algún artículo activo** (`TaxInUseError`), lo use para vender o para comprar.
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

## 5. API y permisos

| Recurso | Listar | Crear | Editar | Desactivar/reactivar |
|---|---|---|---|---|
| Categorías | `GET /api/v1/catalog/categories` | `POST` | `PUT /:categoryId` | `PUT /:categoryId/status` |
| Unidades | `GET /api/v1/catalog/units` | `POST` | `PUT /:unitId` | `PUT /:unitId/status` |
| Impuestos | `GET /api/v1/catalog/taxes` | `POST` | `PUT /:taxId` | `PUT /:taxId/status` |
| Bodegas | `GET /api/v1/catalog/warehouses` | `POST` | `PUT /:warehouseId` | `PUT /:warehouseId/status` |

Más `PUT /api/v1/catalog/warehouses/:warehouseId/default` para elegir la bodega por defecto.

**Permisos** (`catalog.{recurso}.{acción}`), con `{recurso}` = `categories`, `units`, `taxes` y
`warehouses`. Los de artículos son `inventory.items.*`:

| Acción | Permite |
|---|---|
| `search` | Listar |
| `create` | Crear |
| `update` | Editar (y, en bodegas, elegir la de por defecto) |
| `deactivate` | Desactivar y reactivar |

---

## 6. Pantallas

| Ruta | Qué hace |
|---|---|
| `/catalogo` | Redirige a la primera sección que el rol puede ver |
| `/catalogo/categorias` | Nombre y descripción |
| `/catalogo/unidades` | Nombre y abreviatura |
| `/catalogo/impuestos` | Nombre y porcentaje, con coma decimal |
| `/catalogo/bodegas` | Nombre, dirección y marca «Por defecto»; opción «Marcar por defecto» |

- Todas comparten la misma tabla: código, columnas propias, estado y menú **Opciones** (Editar,
  Desactivar o Reactivar). Crear y editar abren el mismo panel lateral.
- El módulo aparece en la barra lateral **solo si el rol puede ver alguna sección**; cada sección,
  solo si puede consultarla.

---

## 7. Datos de demostración

| Empresa | Unidades | Categorías | Impuestos | Bodegas |
|---|---|---|---|---|
| Acme | Unidad, Caja, Kilogramo | Bebidas, Limpieza | IVA 16 %, Exento | Principal (defecto), Norte |
| Globex | Unidad, Caja, Kilogramo | Repuestos | IVA 16 % | Central (defecto) |
| Initech | Unidad | — | — | Principal (defecto), Secundaria |

---

## 8. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio y aplicación | `contexts/catalog/**/*.spec.ts` | Cada regla anterior, sin base de datos |
| Contrato | `catalog-repositories.contract.ts` | 29 casos contra doble y PostgreSQL: unicidad, código, contador con 20 peticiones simultáneas, bodega por defecto y si un artículo activo usa una categoría, un impuesto o una unidad |
| API | `tests/api/catalog.api.spec.ts` | Reglas por HTTP y permisos |
| Interfaz | `tests/ui/catalog.spec.ts` | Recorrido categoría → artículo (en Inventario) → categoría protegida; errores en español; solo lectura; rol sin permisos |
| Aislamiento | `tests/isolation/*` | 9 ataques contra el catálogo de Globex |
