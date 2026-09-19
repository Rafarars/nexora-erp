# Revisión de módulos y submódulos

Con los hitos H0–H7 terminados, cada submódulo se revisa **uno por uno** con el mismo método.
Este archivo es el **checklist**: dice qué se revisó, qué falta y dónde está cada informe, para no
revisar dos veces lo mismo.

## Método

Para cada submódulo:

1. **Funcionalidad del sistema.** Todo lo que hace: crear, editar, consultar y cambiar de estado;
   permisos, pantallas, API y base de datos. También lo que usa de otros módulos y lo que otros
   módulos usan de él. Cada regla se cita con `archivo:línea` y, cuando hace falta, se reproduce
   contra la API local.
2. **Reglas del compañero.** Las del mismo submódulo en la documentación de
   [verlumyx/erp](https://github.com/verlumyx/erp/tree/main/docs), si lo tiene.
3. **Qué hace un ERP.** Cómo resuelven ese submódulo Odoo, SAP Business One, Microsoft Dynamics 365
   Business Central, ERPNext y otros, con enlaces verificables.
4. **Comparación.** Una matriz regla por regla: sistema, compañero, web y veredicto.
5. **Segunda opinión.** `agy` (Gemini) hace la misma revisión por su cuenta, sin ver la mía, y
   después se contrastan las dos.
6. **Hallazgos.** Cada uno lleva prioridad, evidencia, opciones y una recomendación. **Solo se
   reportan**: Rafael decide qué se corrige, y la decisión se anota en el mismo informe.

Veredictos de la matriz: **coincide**, **difiere con motivo** (decisión de alcance o de diseño),
**hueco** (algo que el sistema debería hacer y no hace) y **sobra** (algo que el sistema hace de
más).

> **El método ya está escrito como skill.** Desde el 18-sep-2026 vive fuera de este repositorio, para poder usarlo en
> cualquier proyecto: la skill **`module-review`** (en `~/.claude/skills/`) es el procedimiento ejecutable, y el método
> largo con su porqué está en el repositorio **`engineering-playbook`** (`method/module-review.md`). Lo que sigue en
> esta página es cómo se aplica **aquí**: el orden de los submódulos, su estado y sus informes.

**Artículos fue el piloto.** Cuando esté cerrado, el método se escribe como una **skill** reutilizable
(instrucciones paso a paso, con la forma del informe y la lista de comprobaciones) para revisar los
demás submódulos igual, sin volver a inventar el procedimiento. Lo que la skill tendrá que recoger, de
lo aprendido en Artículos:

- Investigar **antes** de construir, y separar lo investigado (informe del tema) de lo decidido
  (tabla de decisiones de Rafael, con su frase textual cuando la hay).
- Comparar contra tres fuentes: el sistema, el compañero y los ERP, **con cita verificable** en cada fila.
- Verificar cada hallazgo en el código antes de aceptarlo: en dos rondas, la mitad de lo que llegó de
  fuera no se sostuvo.
- Atacar **todos** los hallazgos; los que no se construyen se anotan en `FUTURE.md` con su porqué.
- Cerrar cada paso con `make verify`, commits por partes y el CI en verde.
- Anotar en `PENDIENTE-REVISION.md` cada decisión tomada construyendo, aunque parezca menor.

## Orden y estado

El orden sigue las dependencias: cada módulo se revisa después de aquellos de los que depende.
Artículos va primero porque es el piloto del método.

Estados: ⬜ pendiente · 🔍 revisado, esperando decisiones · ✅ cerrado (decisiones tomadas).

### 1. Catálogo

| Submódulo | Estado | Informe |
|---|---|---|
| Unidades de medida | ✅ Cerrado. Gana la marca de «no admite decimales» | [catalogo/catalogo.md](catalogo/catalogo.md) |
| Categorías | ✅ Cerrado. Siguen planas, con el porqué escrito | [catalogo/catalogo.md](catalogo/catalogo.md) |
| Impuestos | ✅ Cerrado. La retención sale como hito propio | [catalogo/catalogo.md](catalogo/catalogo.md) |
| Bodegas | ✅ Cerrado. Ya no se cierran con documentos abiertos | [catalogo/catalogo.md](catalogo/catalogo.md) |
| Listas de precio | ✅ Cerrado en la fase 5 de Artículos | [temas/listas-de-precio.md](temas/listas-de-precio.md) |

### 2. Inventario

| Submódulo | Estado | Informe |
|---|---|---|
| Artículos (piloto; empezó en Catálogo) | ✅ Cerrado: las seis fases, con sus temas, pruebas y documentación, **más la revisión adversarial de la fase 4** (§12), que era el único flanco sin lupa propia | [inventario/articulos.md](inventario/articulos.md) |
| Ajustes | ✅ Cerrado. Ocho hallazgos: el costo cero, la fecha del kardex, el motivo, la revaluación, la paginación, el rastro de autor, las etiquetas de los filtros y las citas al sistema privado | [inventario/ajustes.md](inventario/ajustes.md) |
| Existencias | ✅ Cerrado. Cinco hallazgos: el reservado que no se veía, el valor con dos reglas de redondeo, la paginación, la moneda y un choque de nombres | [inventario/existencias.md](inventario/existencias.md) |
| Kardex | ✅ Cerrado. Cuatro hallazgos: el listado sin paginar ni filtrar, el orden por identificador, la fecha del documento como filtro y el DTO compartido | [inventario/kardex.md](inventario/kardex.md) |

### 3. Compras

| Submódulo | Estado | Informe |
|---|---|---|
| Proveedores | ✅ Cerrado. Ya no se cierra con órdenes abiertas; listado paginado y con búsqueda | [compras/compras.md](compras/compras.md) |
| Órdenes de compra | ✅ Cerrado. Plazo de pago congelado, listado paginado y con filtros | [compras/compras.md](compras/compras.md) |
| Entradas de mercancía | ✅ Cerrado. No se fechan antes que su orden; filtros por estado y fecha | [compras/compras.md](compras/compras.md) |
| En camino | ✅ Cerrado. Ya no cuenta servicios, avisa de lo atrasado y no lee lo que descarta | [compras/compras.md](compras/compras.md) |

### 4. Ventas

| Submódulo | Estado | Informe |
|---|---|---|
| Clientes | ⬜ | |
| Pedidos | ⬜ | |
| Disponibilidad | ⬜ | |
| Despachos | ⬜ | |
| Facturas | ⬜ | |

### 5. Cuentas por cobrar

| Submódulo | Estado | Informe |
|---|---|---|
| Límite de crédito y facturas a crédito | ⬜ | |
| Facturas por cobrar | ⬜ | |
| Cobros | ⬜ | |
| Antigüedad de saldos | ⬜ | |
| Estado de cuenta | ⬜ | |

### 6. Reportes

| Submódulo | Estado | Informe |
|---|---|---|
| Tablero | ⬜ | |
| Antigüedad de saldos | ⬜ | |
| Estado de cuenta | ⬜ | |
| Ventas por cliente | ⬜ | |
| Valuación del inventario | ⬜ | |

### 7. Acceso

| Submódulo | Estado | Informe |
|---|---|---|
| Sesión | ⬜ | |
| Personas de la empresa | ⬜ | |
| Roles y permisos | ⬜ | |
| Perfil propio | ⬜ | |

## Temas por investigar y ubicar

Cosas que no se diseñan a ciegas: antes de construirlas se investigan (ERP, compañero y sistema) para
decidir **en qué módulo viven** y **qué reglas llevan**. Cada una se resuelve en el submódulo indicado.

| Tema | Pregunta | Se resuelve en | Estado |
|---|---|---|---|
| Artículos en Inventario | Mover código, pantalla y permisos de Catálogo a Inventario (decidido) | Artículos | ✅ Fase 2 |
| Configuración de la empresa y monedas | Qué valores lleva y dónde vive; multimoneda con tasas (decidido: en esta fase) | Artículos (antes de listas de precio) | ✅ Los 5 pasos, hechos y revalidados · [temas/configuracion-empresa.md](temas/configuracion-empresa.md) |
| Listas de precio | En qué módulo vive el maestro y cómo se resuelve el precio | Artículos | ✅ Fase 5 · [temas/listas-de-precio.md](temas/listas-de-precio.md) |
| Adjuntos e imágenes | Módulo genérico de archivos: tabla, relación con cada registro y almacenamiento en el despliegue | Artículos (imagen del artículo) | ⬜ |
| Tipo no inventariado | Si se agrega y qué documentos lo aceptan | Inventario › Existencias | ✅ **No se agrega**: ninguna regla distingue hoy bien de servicio, y un servicio ya no mueve existencia. Porqué en [FUTURE.md](../FUTURE.md) |
| Lotes y series | Qué submódulo son y qué documentos los exigen | Inventario | ⬜ |
| Método de costo | Promedio, FIFO o estándar; por artículo o por categoría | Inventario › Kardex | ✅ **Sigue el promedio ponderado, y solo ese**. El porqué, con lo que se encontró en el sistema de referencia, en [inventario/kardex.md](inventario/kardex.md) y en [FUTURE.md](../FUTURE.md) |
| Servicios en documentos | Comprar y vender servicios si la factura nace del despacho | Compras › Órdenes y Ventas › Facturas | ✅ Fase 6 · [temas/servicios.md](temas/servicios.md) |
| Contexto del despacho | ¿Ventas o Inventario? | Ventas › Despachos | ⬜ |
