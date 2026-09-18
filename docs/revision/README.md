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

## Orden y estado

El orden sigue las dependencias: cada módulo se revisa después de aquellos de los que depende.
Artículos va primero porque es el piloto del método.

Estados: ⬜ pendiente · 🔍 revisado, esperando decisiones · ✅ cerrado (decisiones tomadas).

### 1. Catálogo

| Submódulo | Estado | Informe |
|---|---|---|
| Unidades de medida | ⬜ | |
| Categorías | ⬜ | |
| Impuestos | ⬜ | |
| Bodegas | ⬜ | |

### 2. Inventario

| Submódulo | Estado | Informe |
|---|---|---|
| Artículos (piloto; empezó en Catálogo) | 🔍 | [inventario/articulos.md](inventario/articulos.md) |
| Ajustes | ⬜ | |
| Existencias | ⬜ | |
| Kardex | ⬜ | |

### 3. Compras

| Submódulo | Estado | Informe |
|---|---|---|
| Proveedores | ⬜ | |
| Órdenes de compra | ⬜ | |
| Entradas de mercancía | ⬜ | |
| En camino | ⬜ | |

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
| Listas de precio | En qué módulo vive el maestro y cómo se resuelve el precio | Artículos | ⬜ |
| Adjuntos e imágenes | Módulo genérico de archivos: tabla, relación con cada registro y almacenamiento en el despliegue | Artículos (imagen del artículo) | ⬜ |
| Tipo no inventariado | Si se agrega y qué documentos lo aceptan | Inventario › Existencias | ⬜ |
| Lotes y series | Qué submódulo son y qué documentos los exigen | Inventario | ⬜ |
| Método de costo | Promedio, FIFO o estándar; por artículo o por categoría | Inventario › Kardex | ⬜ |
| Servicios en documentos | Comprar y vender servicios si la factura nace del despacho. **Decidido:** con la regla del compañero, una línea de servicio no cuenta para el estado de recibido o despachado de su orden, así la orden no queda abierta para siempre | Compras › Órdenes y Ventas › Facturas | ⬜ |
| Contexto del despacho | ¿Ventas o Inventario? | Ventas › Despachos | ⬜ |
