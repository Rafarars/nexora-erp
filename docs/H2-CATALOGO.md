# H2 — Catálogo: informe de las fases 0 a 6

Trabajo hecho de corrido la noche del 13 de septiembre de 2026, **sin commitear**, para que
Rafael lo revise antes de repartirlo en commits por fase. Este documento dice qué se hizo
en cada fase, qué archivos la componen, qué decisiones se tomaron y qué encontró la
revisión posterior.

Decisiones de alcance aprobadas antes de empezar: artículos `inventoried` y `service`,
impuestos simples (nombre y porcentaje, sin retenciones), código legible por empresa además
del SKU, y unidades Unidad, Caja y Kilogramo en las semillas.

---

## Fase 0 — Modelo y migración

**Qué se hizo.** Siete tablas nuevas y su migración.

| Tabla | Para qué |
|---|---|
| `code_sequences` | El contador del código legible, por empresa y prefijo |
| `categories` | Clasificación de artículos, un solo nivel |
| `measurement_units` | Unidad, Caja, Kilogramo; sin factor de conversión |
| `taxes` | Nombre y porcentaje, `decimal(7,4)` |
| `warehouses` | Bodegas, una por defecto por empresa |
| `items` | Artículos: SKU, tipo, categoría e impuesto opcionales |
| `item_units` | Las unidades de cada artículo con su factor; exactamente una base |

**Archivos.** `apps/api/prisma/schema.prisma` y dos migraciones:
`20260913043023_create_catalog_context` y `20260913050741_guard_default_warehouse`.

**Decisiones.**

- **Nada se borra**: cada maestro lleva `is_active`. Las claves ajenas entre maestros son
  `RESTRICT`; contra `tenants`, `CASCADE`, como el resto del esquema.
- **Claves ajenas compuestas con la empresa** (`tenant_id, category_id` → `categories`):
  ni la propia base acepta un artículo de Acme que apunte a una categoría de Globex,
  aunque alguien escriba SQL a mano.
- **Restricciones `CHECK`** que Prisma no expresa: porcentaje entre 0 y 100, factor mayor
  que cero, y la unidad base con factor 1.
- **Índice único parcial** `warehouses_one_default_per_tenant`: una sola bodega por defecto
  por empresa, aunque dos personas la elijan a la vez. Antes de añadirlo se comprobó con
  `prisma migrate diff` que Prisma no lo interpreta como deriva.

**Por qué hay dos migraciones y no una.** La segunda (el índice parcial y
`unique(tenant_id, id)` en bodegas) salió de la revisión. Unirlas exigía `prisma migrate
reset`, y **Prisma bloqueó el reinicio** al detectar que lo invocaba un agente: es una
protección contra borrar datos sin consentimiento, y no se saltó. Se restauró la primera
migración tal cual (su checksum ya estaba registrado) y se generó la segunda con
`prisma migrate diff`. **Si se prefieren unidas antes del commit**, hay que ejecutar a mano
`pnpm --filter api exec prisma migrate reset`, borrar las dos carpetas y regenerar una.

---

## Fase 1 — Dominio

**Qué se hizo.** `apps/api/src/contexts/catalog/domain/`, sin NestJS, sin Prisma y sin
base de datos.

| Carpeta | Contenido |
|---|---|
| `shared/` | `TenantId` propio, `CatalogCode`, puerto `CodeSequence`, `BoundedText`, `CatalogRecord` |
| `category/`, `measurement-unit/`, `tax/`, `warehouse/`, `item/` | Entidad, value objects, puerto del repositorio, `find/` y `unique/` |
| `warehouse/default/` | `DefaultWarehouse`: la primera bodega es la de por defecto; mover la marca es una sola escritura |
| `item/references/` | `ItemReferences`: lo que un artículo usa existe en su empresa y está activo |
| `item/usage/` | `CatalogUsage`: lo que usa un artículo activo no se desactiva |
| `errors/` | 26 errores de dominio, cada uno con su mensaje público |
| `testing/` | `catalog.mother.ts` |

**Reglas de negocio** (cada una con su prueba):

- Nombre único por empresa en categorías, unidades, impuestos y bodegas; abreviatura única
  en unidades; **SKU único por empresa, guardado en mayúsculas** (`agua-500` = `AGUA-500`).
- Un artículo tiene **al menos una unidad, exactamente una base con factor 1 y ninguna
  repetida**. Las unidades se guardan en un orden canónico, la base primero.
- **No se desactiva** una categoría, unidad o impuesto que use un artículo activo; tampoco
  la bodega por defecto, y una bodega inactiva no puede ser la de por defecto.
- Al **crear** un artículo, todo lo que referencia debe estar activo. Al **editar** se
  tolera conservar una referencia que se desactivó después. Al **reactivar** un artículo,
  sus referencias deben estar activas.
- Textos con el largo máximo de su columna, porcentajes y factores con hasta cuatro
  decimales.

**Decisiones.**

- **El catálogo no importa nada de `access`.** Tiene su propio `TenantId`: los dos
  contextos hablan de la misma empresa por su identificador, que viaja en la sesión.
- **`CatalogRecord`** reúne lo que comparten los cinco maestros: código, estado y fechas.
  La política de no borrado vive ahí: hay `activate` y `deactivate`, y ningún método que
  haga desaparecer un registro.
- Las comprobaciones de unicidad son **servicios de dominio** (`CategoryUniqueness`...),
  con un parámetro `except` para que un registro conserve su propio nombre al editarse.

---

## Fase 2 — Aplicación

**Qué se hizo.** 21 casos de uso en `application/`, uno por carpeta y con un único `run()`.

| Recurso | Casos de uso |
|---|---|
| Categorías, unidades, impuestos | `Creator`, `Updater`, `StatusChanger`, `Searcher` |
| Bodegas | Los cuatro y `DefaultWarehouseSetter` |
| Artículos | Los cuatro; `ItemSearcher` devuelve los nombres de lo que el artículo usa |

`application/testing/catalog-scenario.ts` monta el mundo de una prueba en una línea, con los
repositorios en memoria.

**Decisiones.**

- **Primero lo que no necesita la base**: un valor inválido responde 400 sin consultar nada.
- **El código se pide al final**: una validación que falla no consume un número.
- `ItemSearcher` resuelve los nombres de categoría, impuesto y unidades para que la tabla de
  artículos no tenga que cruzar cuatro listados, **ni pedir permiso para leerlos**.
- `FixedClock` y `SequentialIdGenerator` pasaron de `access` a
  `shared/infrastructure/testing/`: ahora los usan dos contextos.

---

## Fase 3 — Infraestructura y contrato de puerto

**Qué se hizo.** Cinco repositorios Prisma, el contador atómico y el contrato ejecutado
contra los dobles y contra PostgreSQL.

| Archivo | Qué hace |
|---|---|
| `persistence/prisma-*.repository.ts` | Un adaptador por agregado |
| `persistence/prisma-code-sequence.ts` | `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` en una sola sentencia |
| `persistence/unique-violation.ts` | Reconoce el rechazo por duplicado y lo traduce al error de dominio |
| `infrastructure/testing/in-memory-*.ts` | Los dobles, que imitan también las restricciones de la base |
| `testing/catalog-repositories.contract.ts` | La suite de 34 casos que corre dos veces |

**Lo que encontró el contrato contra PostgreSQL el primer día** (7 fallos de 32):

1. `@updatedAt` y `@default(now())` pisaban las fechas del dominio → ahora se escriben explícitas.
2. Las pruebas reutilizaban el código del object mother y la base lo rechazaba; **el doble
   lo aceptaba** → el doble ahora exige código único como la base.
3. El orden de las unidades de un artículo dependía de la base → orden canónico en el dominio.
4. Con el adaptador de PostgreSQL, Prisma 7 no informa el duplicado en `meta.target` sino en
   `meta.driverAdapterError.cause.constraint.index` → se sondeó la forma real y se fijó en
   una prueba unitaria.

**Decisiones.**

- **Carrera de duplicados**: la comprobación previa del dominio no cubre dos altas
  simultáneas. La base las rechaza y el repositorio traduce el rechazo al mismo error de
  dominio, así que la respuesta es **409 y no 500**.
- **Contador atómico**: veinte peticiones simultáneas reciben veinte números distintos; hay
  prueba de contrato y prueba end-to-end para eso. Un alta que falla después deja un hueco,
  y eso se acepta. Un duplicado, no.
- Los `upsert` buscan por **empresa e identificador** (`tenantId_id`): aunque llegara un
  identificador ajeno, nunca se sobrescribiría la fila de otra empresa.

---

## Fase 4 — API, permisos y aislamiento

**Qué se hizo.** 21 controladores bajo `/api/v1/catalog/`, 20 permisos y la matriz de
aislamiento ampliada.

| Ruta | Permiso |
|---|---|
| `GET /catalog/{recurso}` | `catalog.{recurso}.search` |
| `POST /catalog/{recurso}` | `catalog.{recurso}.create` |
| `PUT /catalog/{recurso}/:id` | `catalog.{recurso}.update` |
| `PUT /catalog/{recurso}/:id/status` | `catalog.{recurso}.deactivate` |
| `PUT /catalog/warehouses/:id/default` | `catalog.warehouses.update` |

Con `{recurso}` = `categories`, `units`, `taxes`, `warehouses`, `items`.

**Decisiones.**

- **Los permisos se declaran en `access`** (`CATALOG_PERMISSIONS` junto a
  `ACCESS_PERMISSIONS`, reunidos en `SYSTEM_PERMISSIONS`). Autorizar es trabajo de ese
  contexto; los demás solo nombran el permiso en su `@RequirePermission`.
  `route-declaration.spec.ts` y `make migrate` los leen de ahí.
- **Elegir la bodega por defecto es una ruta propia**, no un campo del formulario: quitarle
  la marca a una bodega solo tiene sentido dándosela a otra.
- **El catálogo no declara guardián**: el de `access` es global, y un contexto nuevo nace
  cerrado sin hacer nada. Comprobado: sin sesión, 401 en las cinco rutas de lectura.
- La matriz de aislamiento tiene **12 ataques nuevos** (24 con los dos atacantes), y
  `globexSnapshot` fotografía también el catálogo de Globex antes y después de cada uno.

---

## Fase 5 — Frontend

**Qué se hizo.** El módulo «Catálogo» en la barra lateral, con cinco secciones.

| Pieza | Qué es |
|---|---|
| `modules/catalog/domain/` | Modelo propio, puerto `CatalogApi`, `readableCatalogError`, secciones visibles por permiso y utilidades puras (`describeUnits`, `parseDecimal`) |
| `modules/catalog/infrastructure/http-catalog-api.ts` | El único sitio que conoce las rutas del catálogo |
| `app/(app)/catalogo/` | `layout.tsx`, índice, cinco páginas y `actions.ts` |
| `sections/catalog/catalog-table.tsx` | Tabla genérica: menú Opciones por fila y panel lateral para crear y editar |
| `sections/catalog/items-board.tsx` | La tabla de artículos y su formulario con editor de unidades |

**Decisiones.**

- **`CatalogTable` es genérica** y cada pantalla solo declara columnas y campos: las cinco
  pantallas se comportan igual y las pruebas usan los mismos `data-testid`
  (`category-row-Bebidas`, `item-options-AGUA-500`).
- **El módulo aparece solo si el rol puede ver alguna sección**, y cada sección solo si
  puede consultarla. Escribir la dirección a mano muestra un aviso, no un error.
- **El formulario de artículos exige poder leer categorías, impuestos y unidades**; sin esos
  permisos no se ofrece, en vez de mostrar selectores vacíos.
- **Coma decimal**: «8,5» se entiende como 8.5. Lo que no es un número no se adivina: lo
  rechaza la API señalando el campo, y la interfaz lo explica en español.
- `AccessError` se reutiliza como error de la API en el catálogo. Su nombre ya no describe lo
  que es; queda anotado en `docs/FUTURE.md` renombrarlo a `ApiError`.
- `Field`, `RowOptions` y `SlideOver` pasaron de `sections/access/` a `sections/shared/`.
- En Roles, los módulos se titulan en español («Catálogo», «Acceso y administración») en vez
  del prefijo técnico.

---

## Fase 6 — Semillas y pruebas end-to-end

**Semillas.**

| Empresa | Catálogo |
|---|---|
| Acme Industrial | Unidad, Caja, Kilogramo · Bebidas, Limpieza · IVA 16 %, Exento · Principal (por defecto), Norte · Agua mineral 500 ml (caja de 24), Detergente 1 kg, Servicio de entrega |
| Globex Servicios | Unidad, Caja, Kilogramo · Repuestos · IVA 16 % · Central · Filtro de aceite |
| **Initech Logística** (nueva) | Unidad · Principal (por defecto), Secundaria |

El rol «Consulta» de Acme recibe los permisos de lectura del catálogo: es el que prueba que
ver no es lo mismo que editar.

**Por qué una tercera empresa.** La bodega por defecto existe una vez por empresa. Las
pruebas corren en paralelo, y una que la moviera en Acme haría fallar de vez en cuando a
otra que en ese instante comprueba que Principal no se puede desactivar, **o peor, le
permitiría desactivarla**. Initech solo la usa una prueba, con su propia administradora
(`dora@initech.com`).

**Pruebas nuevas.**

| Archivo | Qué cubre |
|---|---|
| `tests/api/catalog.api.spec.ts` | Códigos legibles, duplicados, reglas de desactivación, porcentajes con decimales, SKU en mayúsculas, unidades sin base, **8 altas simultáneas con códigos distintos**, permisos, 401 sin sesión y UUID malformado |
| `tests/ui/catalog.spec.ts` | El recorrido del hito (categoría → artículo con caja de 24 → categoría protegida → desactivar artículo → desactivar categoría), SKU duplicado explicado en español, coma decimal, edición desde Opciones, bodega por defecto, rol de solo lectura y rol sin permisos de catálogo |
| `tests/isolation/tenant-isolation.api.spec.ts` | 12 ataques nuevos contra el catálogo de Globex |
| `pages/catalog.page.ts` | Page object compartido por las cinco pantallas |

---

## Revisión posterior

Hecha al terminar la fase 6: todo el código, el sistema levantado y las propias pruebas.

| Hallazgo | Arreglo |
|---|---|
| **Falso positivo en `isolation-coverage.spec.ts`**: el comentario «Sin tenantId:» de un DTO se leía como un campo | La prueba ignora comentarios, y ahora **recorre todos los contextos**; antes solo miraba `access`, y el catálogo habría nacido sin vigilancia |
| **Una prueba afirmaba lo contrario de su nombre** («no aparece sin permisos» comprobaba que la administradora sí lo ve) | Reescrita: crea un rol sin permisos de catálogo y comprueba el enlace, el índice y una página |
| **Carrera entre pruebas paralelas** por la bodega por defecto de Acme | Empresa Initech dedicada |
| **Dos bodegas por defecto** posibles con dos peticiones simultáneas | Índice único parcial y `ConcurrentDefaultWarehouseError` (409) |
| `upsert` por identificador sin empresa | Por `tenantId_id` en los cinco repositorios |
| El radio de la unidad base no seguía a la unidad al cambiarla | La marca sigue a la unidad de su fila |
| Imports con `@/` en `modules/catalog` no resolvían en Vitest | Relativos, como en `modules/access` |
| `permission-searcher.spec.ts` suponía que todo permiso era de `access` | Comprueba que el módulo es el prefijo del código |
| `formatNumber` agrupaba miles («12.345»): un factor ≥ 10 000 no se podía volver a guardar | Sin agrupar, con prueba de ida y vuelta |
| El error de «Marcar por defecto» se perdía al cerrarse el menú | Su estado vive en la tabla |
| En un artículo nuevo ninguna unidad quedaba como base | La primera elegida queda marcada |

---

## Validación

`make verify` completo en verde, ejecutado dos veces (la segunda tras los últimos arreglos):

| Nivel | Antes del H2 | Ahora |
|---|---|---|
| Unitarias de la API | 511 | **1023** |
| Unitarias del frontend | 28 | **62** |
| Contrato de puerto (PostgreSQL) | 33 | **67** |
| End-to-end (API, interfaz, aislamiento, resiliencia) | 105 | **153** |

Además, antes de escribir las pruebas se recorrió la API a mano con `curl` (alta, duplicado,
400 con campos, 404 entre empresas, 403 de solo lectura, 401 sin sesión, UUID malformado,
unidad ajena, artículo sin base y SKU en minúsculas): todo respondió lo esperado.

---

## Qué falta para cerrar el H2

- **Revisión de Rafael** y commits por fase.
- **Propuesta de regla** (no aplicada, requiere aprobación): que `architecture.spec.ts`
  prohíba que un contexto importe de otro. Hoy se cumple por disciplina.
- Actualizar el reporte publicado y el CI tras el push.
