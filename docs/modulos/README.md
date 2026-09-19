# Documentación de módulos — Nexora ERP

Qué hace cada módulo, con qué reglas de negocio, cómo guarda los datos, qué expone por API,
qué pantallas tiene y qué pruebas lo protegen. Es la referencia **funcional**; la convención
técnica está en [`../ARCHITECTURE.md`](../ARCHITECTURE.md) y el porqué de cada hito, en los
informes `H2-CATALOGO.md`, `H3-INVENTARIO.md`, `H4-COMPRAS.md`, `H5-VENTAS.md`,
`H6-CUENTAS-POR-COBRAR.md` y `H7-REPORTES.md`.

| Archivo | Módulo | Submódulos | Hito |
|---|---|---|---|
| [acceso.md](acceso.md) | Acceso y administración | Sesión, empresas, personas, roles y permisos, perfil | H1 |
| [empresa.md](empresa.md) | Empresa | Datos de la empresa, parámetros (moneda, tasa de los documentos, zona horaria, decimales), monedas y tasas de cambio | Revisión |
| [catalogo.md](catalogo.md) | Catálogo | Categorías, unidades de medida, impuestos, bodegas | H2 |
| [inventario.md](inventario.md) | Inventario | Artículos, ajustes, kardex, existencias | H3 |
| [compras.md](compras.md) | Compras | Proveedores, órdenes de compra, entradas de mercancía, en camino | H4 |
| [ventas.md](ventas.md) | Ventas | Clientes, pedidos con reserva, despachos, facturas, disponibilidad | H5 |
| [cuentas-por-cobrar.md](cuentas-por-cobrar.md) | Cuentas por cobrar | Cobros, facturas por cobrar, antigüedad, estado de cuenta, límite de crédito | H6 |
| [reportes.md](reportes.md) | Reportes y tablero | Tablero, antigüedad, estado de cuenta, ventas por cliente, valuación del inventario | H7 |

Orden de dependencia: **Acceso → Empresa → Catálogo → Inventario → Compras → Ventas → Cobranza → Reportes**.
Cada módulo usa los anteriores y ninguno importa código de otro: se leen por puertos propios. La
única escritura entre módulos es la del inventario pedida por compras (entradas) y ventas (reservas
y despachos), por un contrato publicado ([compras.md §5](compras.md#5-cómo-se-mueve-la-existencia)).
Ventas, además, consulta a cuentas por cobrar la deuda del cliente y lo cobrado de una factura por
otro contrato publicado, sin escribir nada ([cuentas-por-cobrar.md](cuentas-por-cobrar.md)). Reportes
solo lee, de todos ([reportes.md](reportes.md)).

---

## Qué está revisado y qué no

Estas páginas describen lo que el sistema **hace hoy**. Otra cosa distinta es si esas reglas se han
contrastado con cómo lo resuelven un ERP de referencia y el sector: eso es la **revisión módulo por
módulo**, cuyo estado vive en [`../revision/README.md`](../revision/README.md).

| | |
|---|---|
| **Revisado y cerrado** | Inventario › **Artículos** (el piloto del método), y con él la configuración de la empresa y la multimoneda, las listas de precio y los servicios en los documentos. Y el **Catálogo** entero: unidades, categorías, impuestos y bodegas |
| **Documentado pero sin revisar** | Todo lo demás. Funciona y está probado, pero sus reglas **no se han contrastado** con un ERP de referencia |
| **Lo que falta a propósito** | [`../FUTURE.md`](../FUTURE.md), con qué es, por qué se dejó fuera y qué haría falta |

La diferencia importa: «probado» significa que hace lo que dijimos; «revisado» significa que lo que
dijimos es lo que un ERP debería hacer.

---

## Convenciones que valen para todos los módulos

### Multiempresa

- Todo registro de negocio lleva `tenant_id`. La empresa activa **sale del token**, nunca del
  cuerpo ni de la ruta.
- Un registro de otra empresa **no existe** para quien pregunta: responde **404, no 403**.
- Las claves ajenas entre tablas de negocio son **compuestas con la empresa**
  (`tenant_id, category_id`): ni la base acepta referencias cruzadas.

### Política de no borrado

- **Ningún registro se borra.** Los maestros se desactivan (`is_active`) y los documentos se
  anulan (`status = cancelled`).
- No existe ninguna ruta `DELETE` de negocio. (La única es retirar un rol a una persona, que
  quita una asignación, no un registro.)

### Código legible

- Cada maestro y documento tiene, además del UUID, un **código correlativo por empresa**:
  prefijo de 3 letras y 6 dígitos (`ART000001`). Lo asigna el sistema.
- Lo entrega la tabla `code_sequences` con una sola sentencia atómica: dos altas simultáneas
  nunca reciben el mismo número. Un alta que falla después deja un hueco, y se acepta.

| Prefijo | Qué numera |
|---|---|
| `CAT` | Categorías |
| `UOM` | Unidades de medida |
| `IMP` | Impuestos |
| `BOD` | Bodegas |
| `LPR` | Listas de precio |
| `ART` | Artículos |
| `AJU` | Ajustes de inventario |
| `OC` · `ENT` | Órdenes de compra y entradas de mercancía |
| `PED` · `DES` · `FAC` | Pedidos de venta, despachos y facturas |
| `COB` | Cobros |

### Permisos

- Cada ruta declara quién la alcanza: `@Public`, `@AuthenticatedOnly` o
  `@RequirePermission('modulo.recurso.accion')`. **Lo que no declara nada se deniega.**
- El código del permiso es `modulo.recurso.accion`; el primer segmento es el módulo con el que
  la pantalla de Roles agrupa las casillas.
- Qué permisos **existen** es código (`permissions.catalog.ts`, sincronizado por `make migrate`);
  quién los **tiene**, base de datos, editable desde Roles.
- El guardián consulta la base en cada petición: quitar un permiso tiene efecto inmediato.

### Errores

- Cada error tiene un **código** (el nombre de su clase), un mensaje interno para registros y un
  **mensaje público** sin identificadores.
- Respuesta: `{ statusCode, error, message }`; la validación añade `fields`.
- La interfaz **nunca muestra el texto de la API**: traduce por código, luego por campo, luego por
  categoría, siempre en español.

| Categoría | HTTP |
|---|---|
| No existe | 404 |
| Choca con datos existentes o con el estado | 409 |
| Dato inválido | 400 |
| Sin sesión válida | 401 |
| Sin permiso | 403 |
| Demasiados intentos | 429 |

### Decimales

| Uso | Precisión | Cómo se calcula |
|---|---|---|
| Cantidades | 4 decimales | Enteros de diezmilésimas (`BigInt`) |
| Costos unitarios | 6 decimales | Enteros de millonésimas |
| Precios unitarios | 6 decimales | Enteros de millonésimas, `decimal(18,6)`. Cuántos acepta la pantalla lo decide la empresa (`price_decimals`, 0 a 8) |
| Porcentajes | 4 decimales | `decimal(7,4)` |
| Factores de conversión | 8 decimales | `decimal(18,8)`. Con cuatro, una pieza de una caja de mil no se podía expresar |

La interfaz acepta **coma decimal** («8,5») y nunca agrupa miles en un campo editable.

### Datos de demostración

Contraseña de todas las personas: `Nexora-2026!`.

| Persona | Acme Industrial | Globex Servicios | Initech Logística |
|---|---|---|---|
| `ana@acme.com` | Administradora | — | — |
| `beto@globex.com` | — | Administrador | — |
| `contador@externo.com` | Consulta (solo lectura) | Administradora | — |
| `admin@nexora.com` | Administrador | Administrador | — |
| `dora@initech.com` | — | — | Administradora |
| `vera@volumen.com` | — | — | — (administradora de **Volumen Distribuciones**, la empresa de las guardas de rendimiento) |

Initech existe solo para la prueba que mueve la bodega por defecto: lo que hay una vez por
empresa no se puede mover donde otras pruebas en paralelo lo leen.
