# Estado y siguientes pasos

Documento de traspaso: contiene lo necesario para continuar el proyecto **sin depender
de ninguna conversación anterior**.

**Actualizado:** 19 de septiembre de 2026

---

## Lo siguiente, en una línea

**Las cuatro decisiones que esperan a Rafael**, abajo en «Decisiones esperando a Rafael». Y sólo
después, las **mejoras de diseño del sistema**. El detalle está en
[«El plan para cerrar el sistema al 100 %»](#el-plan-para-cerrar-el-sistema-al-100--acordado-el-19-sep-2026).

**Los veintinueve submódulos están revisados.** Acceso cerró el 19-sep-2026 con doce hallazgos
([informe](revision/acceso/acceso.md)) y Reportes ese mismo día con doce, todos construidos
([informe](revision/reportes/reportes.md)). El estado exacto de cada uno, en
[`revision/README.md`](revision/README.md).

---

## Cómo retomar

0. Leer [`docs/modulos/`](modulos/README.md) — qué hace cada módulo y con qué reglas
1. Leer [`AGENTS.md`](../AGENTS.md) — reglas del proyecto
2. Leer [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — convención hexagonal
3. Buscar en Engram, proyecto `nexora-erp`, para el porqué de cada decisión
4. `make up` y `make verify` para confirmar que todo sigue en verde
5. **Dónde quedamos y qué sigue**: al final de este archivo, «Revisión módulo por módulo» → «Dónde quedamos» y
   «Plan de las fases que faltan»

**Ojo con la carga de la máquina:** la suite completa lanza los proyectos en paralelo, y con la máquina ocupada
(load ~7, otros contenedores corriendo) alguna prueba de aislamiento puede caer con `socket hang up` sobre una
ruta pesada —la valuación del inventario o la disponibilidad—. No es un defecto del sistema: la API sigue sana y
sin un solo error interno, y `npx playwright test --project=isolation` pasa sus 130 casos. Comprobado el
18-sep-2026. Si aparece, mirar el `load average` antes que el código.

**Ojo con la base de desarrollo:** las pruebas de contrato la vacían. Después de `make verify`, o de correr contratos
sueltos, hay que `make seed` antes de la suite end-to-end o de mirar la interfaz. Y `make up` reconstruye las imágenes:
un cambio de API o de web no se ve en el navegador ni en la e2e hasta que se ejecuta.

---

## Dónde estamos

| | |
|---|---|
| Repositorio | github.com/Rafarars/nexora-erp |
| Reporte de pruebas | https://rafarars.github.io/nexora-erp/ |
| Pruebas | 2884 + 194 unitarias · 229 de contrato · 415 end-to-end |
| **H0 — Fundación** | **Completado** |
| **H1 — Multiempresa y acceso** | **Completado** y revisado |
| **H2 — Catálogo** | **Completado** ([`H2-CATALOGO.md`](H2-CATALOGO.md)) |
| **H3 — Inventario** | **Completado** ([`H3-INVENTARIO.md`](H3-INVENTARIO.md)) |
| **H4 — Compras** | **Completado** ([`H4-COMPRAS.md`](H4-COMPRAS.md)) |
| **H5 — Ventas** | **Completado**. Informe en [`H5-VENTAS.md`](H5-VENTAS.md) |
| **H6 — Cuentas por cobrar** | **Completado**. Informe en [`H6-CUENTAS-POR-COBRAR.md`](H6-CUENTAS-POR-COBRAR.md) |
| **H7 — Reportes y tablero** | **Completado**. Informe en [`H7-REPORTES.md`](H7-REPORTES.md) |
| **Revisión módulo por módulo** | **Terminada el 19-sep-2026**: los veintinueve submódulos revisados, empezando por Artículos (el piloto). El método ya es la skill `module-review`. Ver [la sección de abajo](#revisión-módulo-por-módulo) y [`revision/README.md`](revision/README.md) |

Lo que ya funciona: monorepo con API, frontend y suite E2E; PostgreSQL en Docker;
endpoint de salud que verifica la base; CI con cuatro trabajos publicando el reporte;
configuración validada al arrancar; Makefile con `verify` y `verify-clean`; convención
de arquitectura escrita; primitivas de dominio; el esquema de acceso con su migración; y
el dominio del contexto de acceso completo, con sus reglas de negocio probadas; y los
cinco casos de uso del acceso, probados sin base de datos; los repositorios Prisma
verificados por un contrato de puerto; el catálogo de permisos declarado en el código; y
el inicio de sesión funcionando de punta a punta, con dos empresas de demostración; y la
API entera protegida por un guardián que deniega por defecto.

---

## Decisiones cerradas — no volver a discutirlas

Cada una tiene su razonamiento completo en Engram.

**Multiempresa**
- El `tenantId` viaja **dentro del token**, nunca en cabecera ni en ruta
- Cambiar de empresa = endpoint que verifica pertenencia y **reemite el token**
- `User` no lleva `tenantId`: correo único global, y una **membresía** lo ata a cada empresa
- Los roles se asignan a la **membresía**, no al usuario
- El `TenantId` es **obligatorio en la firma** de cada método de puerto: si se olvida el
  filtro, no compila

**Autorización**
- Guardián declarativo que **deniega por defecto**: un endpoint sin permiso declarado se
  rechaza; para abrirlo hay que marcarlo explícitamente como público
- Permisos identificados por su **código** (`sales.invoices.create`), sin identificador artificial
- Rol de administrador con `grantsAll`, para que los permisos futuros queden cubiertos
- **Superusuario sin atajos**: membresía en todas las empresas, ningún `if` que salte el guardián
- El aislamiento entre empresas responde **404, no 403**

**Otras**
- Hashing con **Argon2**
- El token vive en una cookie `httpOnly` puesta por el servidor de Next; el navegador nunca lo ve
- **Una sola API**, diseñada como pública: rutas versionadas, DTOs, errores consistentes
- Código en inglés, comentarios en español y cortos, commits en español sin firmas

---

## Fases restantes del H1

### Fase 2 — Dominio ✅

Hecha. `contexts/access/domain/` con `tenant/`, `user/`, `membership/`, `role/`, `errors/`,
los servicios `SignInPolicy` y `PermissionChecker`, y los cuatro puertos.

Dos pruebas verifican propiedades del sistema, no funcionalidades:

- `domain-purity.spec.ts` recorre todos los archivos de `domain/` y exige que cada
  `import` apunte a código propio. Es el criterio de cierre, automatizado
- `errors/error-categories.spec.ts` comprueba que cada error hereda de su categoría; sin
  ella, un error mal heredado saldría **500 en vez de 404** sin que nadie lo notara

Decisiones que conviene no volver a discutir:

- `PasswordHash` valida **que esté hasheado, no que sea Argon2**: el `$` inicial es el
  estándar del *Modular Crypt Format*. Cambiar de algoritmo no debe tocar el dominio
- `UserRepository` es el **único puerto sin `TenantId`**, porque la persona no pertenece
  a una empresa. Para los usuarios *de* una empresa se pasa por `MembershipRepository`
- `PermissionChecker` comprueba **primero de qué empresa es el rol** y después qué
  concede, para que `grantsAll` no cruce empresas
- Las pruebas van **junto a su código**, no en un árbol espejo: es lo que Vitest descubre
  de fábrica y lo que ya hacía el H0

### Fase 3 — Aplicación ✅

Hecha. `contexts/access/application/` con `authenticate-user/`, `switch-tenant/`,
`create-user/`, `assign-role/`, `search-tenant-users/` y `session/` (la respuesta que
comparten iniciar sesión y cambiar de empresa).

Los dobles viven en `infrastructure/testing/`: cuatro repositorios en memoria, un hasher
falso, un reloj congelado y un generador de identificadores predecible. **Guardan
primitivas, no entidades**, para comportarse como una base de verdad — en la fase 4 son
la mitad de las pruebas de contrato.

Decisiones que conviene no volver a discutir:

- **Las reglas de negocio no viven en los casos de uso.** `RoleFinder`, `UserRegistrar` y
  `MemberEnroller` son servicios de dominio con nombre de negocio; la capa de aplicación
  solo ordena. `UserCreator` pasó de 7 dependencias y 100 líneas a 4 y 39
- `UserAuthenticator` **no usa los finders** a propósito: lanzan `NotFoundError`, y el
  login debe responder siempre `InvalidCredentialsError` para no revelar qué existe
- Se verifica la contraseña **aunque el usuario no exista**: cortar antes revelaría por
  el tiempo de respuesta qué correos están registrados
- Con la contraseña correcta y ninguna membresía activa se responde
  `NoActiveMembershipError`, y con una empresa pedida por slug y revocada,
  `InactiveMembershipError`. **Revisado en la segunda revisión**: al principio se respondía
  `InvalidCredentialsError` para no dar pistas, pero a esa rama solo llega quien ya conoce la
  contraseña, y el mensaje genérico le hacía creer que se había equivocado
- La respuesta **no menciona token ni JWT**: emitirlo es cosa de infraestructura

`architecture.spec.ts` sustituye a la prueba de pureza y añade la dirección de las
dependencias: la aplicación no alcanza infraestructura, y el dominio no conoce a ninguna
de las dos.

### Fase 4 — Infraestructura ✅

Hecha. `infrastructure/persistence/` con los cuatro repositorios Prisma, y
`infrastructure/access.module.ts` como único sitio que decide qué implementación
resuelve cada puerto.

**La pieza que más vende: `testing/access-repositories.contract.ts`.** Una sola suite de
33 casos ejecutada **dos veces** — contra los dobles en memoria y contra PostgreSQL —
con dos archivos de cinco líneas para lanzarla.

**Encontró un defecto el primer día.** Contra PostgreSQL fallaron 2 de 33:
`role_permissions_permission_code_fkey`. El doble aceptaba conceder cualquier código de
permiso; la base exige que exista en el catálogo. Las 250 pruebas que usaban el doble no
tenían forma de saberlo.

Decisiones que conviene no volver a discutir:

- **Un solo arnés para los cuatro repositorios**, no uno por agregado: las membresías y
  los roles tienen claves ajenas, y con arneses separados PostgreSQL rechazaría
  escrituras que el doble acepta. El contrato siembra usando solo la interfaz pública
- `save()` es un **upsert**: el puerto no expone `create()` ni `update()`, quien llama no
  decide si la fila existe
- Las tablas intermedias se reemplazan **dentro de una transacción**, para que nadie lea
  la entidad con los roles a medio camino
- **El catálogo de permisos se declara en el código** (`permissions.catalog.ts`) y lo
  sincroniza `make migrate`, no una prueba: así corre igual en local, en el CI y en el
  servidor. Es idempotente y **nunca borra** — quitar un permiso arrastraría los
  `role_permissions` de las empresas que ya lo tenían
- `pnpm test` **sigue sin necesitar base de datos**: las de contrato van por
  `vitest.integration.config.ts`, con `fileParallelism: false` porque comparten una base

`make verify` pasó a seis pasos. En el CI el contrato corre tras `make migrate` y antes
de Playwright: si los repositorios mienten, el resto sobra.

**Pendiente para la fase 6:** la prueba que cruce los `@RequirePermission` declarados
contra el catálogo, en ambas direcciones. Sin ella, código y catálogo se desincronizan.

### Fase 5 — Autenticación ✅

Hecha. `POST /api/v1/auth/login` y `POST /api/v1/auth/switch-tenant`, un controlador por
acción. `Argon2PasswordHasher` y `JoseTokenIssuer` como adaptadores. El cuerpo se valida
con el mismo zod que valida el entorno, sin añadir otra librería.

El `DomainErrorFilter` deja de estar probado por herencia: 13 pruebas end-to-end golpean
la API real y comprueban que un correo desconocido da **401**, un cuerpo vacío **400** y
una empresa ajena **404**.

Decisiones que conviene no volver a discutir:

- **El `.env.example` no trae ningún secreto escrito.** Un secreto publicado en un
  repositorio público deja de serlo. `make env` genera uno; `make up` **no lo llama solo**
- `NODE_ENV=production` exige un `JWT_SECRET` propio de 32 caracteres o más, verificado al
  arrancar. El contenedor se niega a levantar sin él
- `jwtVerify` **fija el algoritmo**: sin eso, un token con `alg: none` pasaría
- El `switch-tenant` toma el usuario **del token, nunca del cuerpo**
- La sesión lleva `grantsAll` además de los permisos: un administrador no enumera
  permisos, y sin esa marca la interfaz le escondería todos los botones. **Es para la
  interfaz**; el guardián siempre pregunta por un permiso concreto
- El emisor valida su configuración **en el constructor**, para fallar al arrancar y no en
  la primera petición

**Del seed de la fase 9 se adelantó lo imprescindible**: sin dos empresas con datos no se
podía verificar un login real. Contraseñas conocidas a propósito, y por eso **se niega a
correr con `NODE_ENV=production`**. El `globalSetup` de Playwright lo ejecuta en cada
corrida.

### Fase 6 — Guardianes ✅

Hecha. Guardián global (`APP_GUARD`) y **tres declaraciones posibles, ninguna por
omisión**: `@Public()`, `@AuthenticatedOnly()` y `@RequirePermission('...')`. Lo que no
declara nada responde 403.

Se añadieron los tres endpoints que faltaban para que el guardián tuviera algo que
guardar: crear usuario, asignar rol y listar los usuarios de la empresa.

Decisiones que conviene no volver a discutir:

- **El guardián consulta la base, no el token.** Carga usuario, empresa, membresía y
  roles en cada petición: revocar un acceso tiene efecto inmediato en vez de esperar a
  que caduque la sesión. El `grantsAll` del token es solo para la interfaz
- **Los decoradores de clase y de método conviven, no se anulan.** Un `@Public()` en la
  clase junto a un `@RequirePermission()` en el método abriría el endpoint si se
  comprobara lo público primero. Declaraciones contradictorias **cierran**
- Una identidad que ya no existe responde **401, no 404**: el recurso existe, lo que no
  vale es la sesión, y un 404 filtraría identificadores internos
- El `tenantId` **nunca se acepta en el cuerpo**: sale de la sesión

**Dos pruebas verifican propiedades del sistema entero**, en
`route-declaration.spec.ts`: que toda ruta declare quién puede alcanzarla, y que los
`@RequirePermission` y `permissions.catalog.ts` cuadren **en ambas direcciones**. La
segunda encontró dos permisos declarados «por si acaso» que ningún endpoint usaba.

**El analizador de rutas se prueba a sí mismo.** Su primera versión usaba una ventana de
líneas y daba **falso verde**: una ruta sin declarar pasaba si la de al lado tenía un
decorador. Una prueba que vigila el sistema entero y falla en silencio es peor que no
tenerla.

### Fase 7 — Frontend ✅

Hecha. Cuatro pantallas: `/login`, `/` (panel), `/administracion/{usuarios,roles}` y
`/perfil`. La lógica vive en `modules/access/` (dominio, puerto `AccessApi`, adaptador
HTTP y doble en memoria), sin React. El token va en una cookie `httpOnly` puesta por
una acción de servidor: el navegador nunca lo ve.

Decisiones de interfaz, **tomadas por Rafael**:

- **Barra lateral solo para los módulos del negocio.** Administración (Usuarios y Roles)
  y el perfil viven en el **menú del nombre**, al pie. Así inventario o ventas no se
  mezclarán con la gestión de accesos. Administración solo aparece a quien tiene algo
  que administrar
- **Formularios en panel lateral deslizante**: la tabla sigue visible y se comprueba el
  resultado sin recargar
- **Listados con menú «Opciones» por fila**: Editar abre el mismo panel del
  alta ya relleno
- `/estado` es **público**: se consulta justo cuando el sistema está mal, y comprobar la
  sesión necesita la base

**Qué puede editar un administrador de otra persona**: nombre, roles y estado **en su
empresa**. **Nunca el correo ni la contraseña**; esos los cambia la propia persona desde su
perfil, confirmando la contraseña actual: la cuenta es una sola en todas sus
empresas, y cambiarle la contraseña a alguien que también está en otra empresa daría
acceso a esa otra. Desactivar revoca la membresía, no la cuenta. Nadie se desactiva a
sí mismo.

Los permisos se **asignan desde la interfaz** (casillas en Roles) aunque el catálogo se
declare en código: qué permisos *existen* es código; quién los *tiene*, base de datos.

### Fase 8 — Aislamiento entre empresas ✅

Hecha. Proyecto propio de Playwright, `isolation`.

- **Matriz de ataques** (`support/isolation-matrix.ts`): cada endpoint que recibe un
  identificador, llamado con la sesión de la administradora de Acme —todos los permisos,
  así que un rechazo no puede ser por falta de uno— y datos de Globex. Debe responder
  **404** y, después, Globex debe estar **idéntico** a como estaba: un 404 que llega
  tras escribir también sería una fuga
- **La matriz se vigila sola** (`isolation-coverage.spec.ts`): lee los controladores y
  sus DTO y falla si un endpoint que recibe identificadores no tiene su ataque. Verificado
  quitando un caso: lo nombró

Una primera versión de esa vigilancia daba falsos positivos: miraba el controlador
entero y todos usan `session.tenantId`, que viene del token. Ahora solo mira los
parámetros de ruta y los campos del DTO.

### Fase 9 — Semillas ✅

Hecha (`make seed`, idempotente, se niega a correr con `NODE_ENV=production`).

| Persona | Acme Industrial | Globex Servicios |
|---|---|---|
| `ana@acme.com` | Administradora | — |
| `beto@globex.com` | — | Administrador |
| `contador@externo.com` | Consulta | Administradora |
| `admin@nexora.com` | Administrador | Administrador |

Contraseña de todas: `Nexora-2026!`.

- **El superusuario no tiene atajos.** No existe un `if (esSuperusuario)`: puede todo
  porque es administrador en cada empresa, y el guardián lo trata como a cualquiera. La
  matriz de aislamiento lo ataca igual que a Ana: desde su sesión de Acme no toca Globex
- **La contadora** es el caso que justifica que `users` no lleve `tenantId`: una persona,
  dos empresas, dos roles distintos
- **Limpia al empezar y al terminar** cada ejecución de Playwright: borra lo que no es
  suyo, así la base no se queda con personas creadas por las pruebas

### Fase 10 — Cierre ✅

Hecha.

- `docs/ARCHITECTURE.md` al día con lo construido: servicios de dominio, autorización,
  el árbol real del frontend, sesión, navegación, las pruebas de propiedad y los
  antipatrones aprendidos a golpes
- **Cuatro patrones** extraídos al
  [playbook](https://github.com/Rafarars/engineering-playbook/tree/main/patterns):
  `hexagonal-architecture`, `multi-tenancy`, `authorization` y `testing-architecture`
- **Las skills quedan para después**, por decisión de Rafael: una skill escrita con un
  solo caso de uso suele quedar atada a él. Se harán cuando haya un segundo proyecto. Ya
  existe una `hexagonal-architecture` escrita para PHP: elegir nombres que no choquen

## Revisión rigurosa del H0 y el H1 ✅

Pedida por Rafael al cerrar el H1. Cada hallazgo se comprobó con evidencia antes de
corregirlo, y cada prueba nueva se verificó contra falso verde.

**Graves**

- **El login delataba qué correos existen**: 22,6 ms con un correo registrado frente a
  2,4 ms con uno inexistente. Se verificaba contra un hash vacío que Argon2 rechazaba al
  instante. Ahora se usa un hash de relleno real. **La prueba que decía cubrirlo era un
  falso verde**: comparaba cuerpos, no tiempos. Ahora hay dos que miden
- **Las semillas podían borrar una base real**: eliminan a toda persona que no sea de
  demostración y Playwright las corre en cada ejecución, con solo `NODE_ENV` como guarda.
  Ahora se niegan a correr contra un host que no sea local o del compose
- **Sin límite de intentos**: 25 contraseñas falsas seguidas, 25 respuestas 401. Ahora 5
  fallos por correo bloquean 15 minutos, también para correos inexistentes

**Medios**

- La contraseña mínima solo la frenaba la validación HTTP: el alta aceptaba un carácter.
  Ahora es regla del dominio
- `multer`, `mysql2` y `deepmerge-ts` vulnerables dentro de la imagen, aunque no
  alcanzables. Versiones corregidas por `overrides` y fuera de la imagen: `pnpm audit`
  sin avisos
- Sin cabeceras de seguridad y anunciando `X-Powered-By`. Añadidas en API y frontend
- La prueba de arquitectura solo vigilaba `contexts/access`. Ahora cubre todo contexto,
  `shared/domain` y `modules/` del frontend

**Menores**: acciones del CI fijadas por hash; borrado un doble de pruebas sin uso;
pruebas para la validación del entorno del frontend; comentarios con tilde. Lo que no se
corrigió está anotado en `docs/FUTURE.md`, con su porqué.

## Segunda revisión: recorrido de interfaz ✅

Pedida por Rafael tras la primera: volver a verificar todo y **usar cada pantalla** como lo
haría una persona. Se recorrió en el navegador y con una sonda de Playwright suelta.

Lo que se comprobó sin fallos: la suite end-to-end dos veces seguidas, el CI, el alta,
edición, desactivación y reactivación de personas, la creación y edición de roles, el
**efecto inmediato con un mismo token** (403 → 200 → 403 → 200 según roles y permisos, y
401 al desactivar), el perfil, la vista de solo consulta, el cambio de empresa y el cierre
de sesión.

Lo que apareció, y cómo quedó:

| Hallazgo | Arreglo |
|---|---|
| Chrome rellenaba el alta de otra persona con credenciales guardadas | `autoComplete="off"` y `"new-password"` en el alta; `current-password`/`new-password` en el perfil |
| Mensajes de validación en inglés técnico en pantalla | La API devuelve `fields`; la interfaz traduce por código y campo |
| **Trece mensajes de error exponían UUID o lo recibido** | Mensaje público separado del interno; prueba que lo exige |
| **No existía forma de cambiar un correo**, y dos pantallas se remitían entre sí | La propia persona lo cambia desde el perfil con su contraseña actual |
| Un acceso revocado recibía «correo o contraseña incorrectos» | `NoActiveMembershipError` y mensaje propio |
| El cambio de contraseña decía «correo o contraseña incorrectos» | `WrongCurrentPasswordError` (400) y mensaje propio |
| `EmailAlreadyInUseError` no lo lanzaba nadie | Lo lanza el cambio de correo |
| Rol repetido: «ese nombre o ese correo» | «Ya existe un rol con ese nombre.» |

Descartado como defecto: los formularios del perfil dejaron de responder en una pestaña
de la extensión de Chrome, pero una sonda de Playwright independiente los usó sin
problema.

---

## H5 — Ventas

Todo lo hecho, fase por fase, en [`docs/H5-VENTAS.md`](H5-VENTAS.md); las reglas, en
[`docs/modulos/ventas.md`](modulos/ventas.md). Rafael pidió avanzar sin revisar cada hito: las
decisiones tomadas sin preguntar están en **`docs/PENDIENTE-REVISION.md`**, archivo local excluido de
Git que él lee y borra.

Para retomar:

1. Leer `docs/PENDIENTE-REVISION.md` si todavía existe
2. Siguiente hito: **H6 — Cuentas por cobrar** (hecho, ver abajo)

## H6 — Cuentas por cobrar

Todo lo hecho, fase por fase, en [`docs/H6-CUENTAS-POR-COBRAR.md`](H6-CUENTAS-POR-COBRAR.md); las
reglas, con ejemplos para explicarlas a un cliente, en
[`docs/modulos/cuentas-por-cobrar.md`](modulos/cuentas-por-cobrar.md). Alcance aprobado por Rafael;
lo decidido sin preguntar, en `docs/PENDIENTE-REVISION.md`.

Para retomar:

1. Leer `docs/PENDIENTE-REVISION.md` si todavía existe
2. Siguiente hito: **H7 — Reportes y tablero** (hecho, ver abajo)

## H7 — Reportes y tablero

Todo lo hecho en [`docs/H7-REPORTES.md`](H7-REPORTES.md); las reglas, en
[`docs/modulos/reportes.md`](modulos/reportes.md). Con el H7 **terminan los hitos del plan**: Rafael
pidió terminar todos los módulos y después validarlos uno por uno, en detalle.

Para retomar:

1. Leer `docs/PENDIENTE-REVISION.md` si todavía existe
2. **Revisión módulo por módulo** (en curso, ver abajo)
3. Lo que queda fuera del plan está en `docs/FUTURE.md`

Empresas de demostración: Acme Industrial, Globex Servicios e **Initech Logística**
(`dora@initech.com`), esta última solo para la prueba que mueve la bodega por defecto.

## Revisión módulo por módulo

Terminados los hitos, Rafael definió cómo validar el sistema: **un submódulo a la vez, hasta dejarlo al
100 %**, antes de pasar al siguiente. «Es mejor tener un módulo 100 % funcional a tener muchos módulos a
medias».

**El método** está escrito en [`revision/README.md`](revision/README.md): funcionalidad real del sistema
(con reproducción contra la API), reglas del compañero en
[verlumyx/erp](https://github.com/verlumyx/erp/tree/main/docs), lo que hacen los ERP (con enlaces),
matriz comparativa, segunda opinión de `agy` y hallazgos con opciones. **Los hallazgos se atacan
todos**; Rafael decide cómo, y la decisión se anota en el informe. El mismo archivo tiene el
**checklist** de submódulos y los **temas por investigar y ubicar**.

### Estado: Inventario › Artículos (piloto)

Informe completo en [`revision/inventario/articulos.md`](revision/inventario/articulos.md).

| Fase | Contenido | Estado |
|---|---|---|
| 1 · Integridad | H8 una sola base en la base de datos; H1 unidades protegidas con órdenes o pedidos abiertos y entrada con la base de la orden; H2 no desactivar con documentos abiertos; H9 bloqueos `FOR UPDATE`/`FOR SHARE` contra carreras; borradores con caja cambiada piden revisión | ✅ Commits `539659b..ff3360e`, CI en verde, segunda pasada del método hecha |
| 2 · Artículos en Inventario | Mover **código, pantalla y permisos**: contexto `catalog` → `inventory`, ruta `/inventario/articulos`, menú, `catalog.items.*` → `inventory.items.*` (semillas, roles, aislamiento, documentación). Añadir la prueba de interfaz de los mensajes del artículo | ✅ Código en `contexts/inventory`, puertos `CatalogReferences` e `ItemUsage`, migración de permisos, prueba de interfaz de los mensajes |
| 3 · Configuración de la empresa y monedas | Investigada y decidida ([informe](revision/temas/configuracion-empresa.md)): contexto propio `company`, todo de una vez, multimoneda con tasas cargadas a mano, zona horaria. Cinco pasos: 1 Empresa y hoy por zona · 2 Monedas y tasas · 3 Compras · 4 Ventas y cobranza · 5 Reportes | ✅ Los 5 pasos hechos y revalidados ([módulo](modulos/empresa.md)); queda abierta la tasa de fines de semana |
| 4 · Artículo completo | H5 impuesto de venta y de compra; H4 factor con 8 decimales; H6 código de barras, comprable/vendible, mínimo/máximo/reorden; H7 copiar SKU y nombre en las líneas; paginación y búsqueda | ✅ Los cinco puntos, con su pantalla de **Bajo mínimo** ([módulo](modulos/inventario.md) §1 y §1.1) |
| 5 · Listas de precio | Investigar su ubicación; maestro, precio por artículo, lista en el cliente, precio mínimo, precio sugerido en el pedido | ⬜ |
| 6 · Servicios (H3) | Corregir documentación y pantalla. Comprar y vender servicios se hace en Compras y Facturas con la regla del compañero: la línea de servicio no cuenta para recibido o despachado | ⬜ |
| 7 · Cierre | Informe, checklist en ✅, `make verify` | ⬜ |

**Dónde quedamos (17-sep-2026).** Fases 1 y 2 de Artículos cerradas. Fase 3, configuración de la empresa y monedas:
investigada, decidida y con los **pasos 1 a 4 hechos**:

- **Paso 1:** contexto `company` con datos, parámetros y monedas, «hoy» por zona horaria, RIF en reportes.
- **Paso 2:** tasas de cambio por empresa, moneda, fecha y tipo cargadas a mano (Administración › Tasas de cambio);
  la serie de los documentos en los parámetros; contrato publicado `DocumentRates`.
- **Paso 3:** órdenes y entradas de compra con `currency`, `exchange_rate`, `base_currency`, `base_exchange_rate` y
  `manual_exchange_rate`. La moneda la elige quien captura (la de la empresa por defecto); las tasas se refrescan en el
  borrador y se congelan al confirmar; la entrada usa las de su día; el costo entra al inventario en la moneda de la
  empresa. Tasa a mano según el parámetro `allowsRateOverride` (decisión de Rafael). Detalle en
  [`modulos/compras.md`](modulos/compras.md) §2.4 y §3.3.
- **Paso 4:** pedidos con moneda y tasas como las compras; el despacho sin moneda; la factura con la moneda del pedido,
  **la tasa del día de su emisión** y sus importes en bolívares; cobros en cualquier moneda con la tasa de su fecha,
  lo aplicado en la moneda de la factura y el **diferencial cambiario** guardado y mostrado (decisiones de Rafael);
  saldos, antigüedad, crédito y estado de cuenta en la moneda de la empresa. Núcleo compartido
  `shared/domain/amount.ts` y `document-currency.ts`. Bloqueo optimista de los borradores corregido. Detalle en
  [`modulos/ventas.md`](modulos/ventas.md) §2.4 y [`modulos/cuentas-por-cobrar.md`](modulos/cuentas-por-cobrar.md) §1.5.

**Revalidación (17-sep-2026):** los pasos 1 a 4 se compararon con la ley y los ERP, con el compañero, con el código y
la interfaz. Se corrigieron el bloqueo optimista de los cobros, el redondeo de saldos y del estado de cuenta, los
decimales de compras y de precio, los decimales que ya no bajan con documentos y las llaves de `base_currency`. Quedan
**cuatro decisiones legales de Rafael** (tasa de fines de semana, serie legal en facturas, fecha del hecho imponible,
IGTF): [`revision/temas/configuracion-empresa.md`](revision/temas/configuracion-empresa.md) §10.3.

- **Paso 5:** reportes en la moneda de la empresa. El modelo de lectura convierte cada documento en SQL con las dos
  tasas que congeló, antes de agrupar, y redondea a los decimales de la empresa; el costo promedio del inventario ya
  venía convertido. Cada reporte dice su moneda, y la pantalla, el PDF y el Excel la muestran. Detalle en
  [`modulos/reportes.md`](modulos/reportes.md) §0.

**La fase 3 (configuración de la empresa y multimoneda) está cerrada**, con una decisión abierta: la tasa de fines de
semana y feriados ([`revision/temas/configuracion-empresa.md`](revision/temas/configuracion-empresa.md) §10.3, punto 1).

**Fase 4 de Artículos cerrada (18-sep-2026):** impuesto de venta y de compra separados; factor de conversión con 8
decimales; código de barras único por empresa y banderas «se compra» / «se vende» validadas en el dominio; SKU y nombre
del artículo copiados en las líneas de los seis documentos; listado paginado con búsqueda por código, SKU, nombre o
código de barras; y mínimos por bodega con la pantalla **Inventario › Bajo mínimo**, que dice cuánto falta y cuánto
pedir.

**Sigue la fase 5, listas de precio**: investigar dónde vive el maestro, el precio por artículo, la lista en el
cliente, el precio mínimo y el precio sugerido en el pedido. Después, la fase 6 (servicios) y el cierre.

### Plan de las fases que faltan (acordado el 18-sep-2026)

1. **Fase 5 · Listas de precio.** ✅ Hecha el 18-sep-2026. El maestro vive en el Catálogo (`price_lists`, solo nombre y
   moneda) y los precios cuelgan del artículo (`item_prices`, en la unidad base). El pedido resuelve el precio con la
   lista del pedido → la del cliente → la de por defecto, lo multiplica por el factor de la unidad, lo convierte por el
   bolívar si la lista está en otra moneda y lo redondea a los decimales de la empresa; lo escrito a mano manda, y el
   mínimo del artículo es el piso. Tema y fuentes en
   [`revision/temas/listas-de-precio.md`](revision/temas/listas-de-precio.md).
2. **Fase 6 · Servicios.** ✅ Hecha el 18-sep-2026. Un servicio se compra y se vende; su línea copia `moves_stock` y de
   ahí sale todo: no reserva, no se despacha ni se recibe, y no cuenta para el estado, así que un documento que solo
   lleva servicios nace saldado. A la factura entra igual que un tornillo: la del despacho arrastra los servicios
   pendientes del pedido, y un pedido sin mercancía se factura directo. Tema en
   [`revision/temas/servicios.md`](revision/temas/servicios.md).
3. **Fase 7 · Cierre de Artículos.** ✅ Hecha el 18-sep-2026. Informe cerrado en
   [`revision/inventario/articulos.md`](revision/inventario/articulos.md) §10: qué cerró cada fase, los nueve
   hallazgos uno por uno, lo que el piloto enseñó sobre el método y lo que queda abierto.
4. **Revisión exhaustiva de lo construido.** ✅ Hecha el 18-sep-2026. Dos revisiones en paralelo (adversarial de código
   y cobertura de pruebas) más la interfaz a mano. Encontró **diez cosas cuando el módulo ya se daba por cerrado**:
   cinco defectos de código —uno permitía **cobrar dos veces**— y cinco de interfaz, uno de los cuales ninguna prueba
   podía encontrar. Todos corregidos. Informe en
   [`revision/inventario/articulos.md`](revision/inventario/articulos.md) §11.
5. **Convertir el método en skills.** ✅ Hecho el 18-sep-2026, fuera de este repositorio:
   - **`module-review`** y **`module-build`**, skills de Claude Code en `~/.claude/skills/`, en español y agnósticas
     del lenguaje y del sistema.
   - El método largo, con el porqué y los ejemplos, en el repositorio **`engineering-playbook`**:
     `method/module-review.md`, `method/module-development.md`, y los patrones `patterns/money-and-quantities.md`,
     `patterns/business-documents.md` y `patterns/multi-currency.md`.

---

### Hecho el 19-sep-2026 · Cuatro módulos en una sesión, en revisiones **en lote**

**Lo que se cerró:** Compras, Ventas y Cuentas por cobrar enteros, más una auditoría acotada de
Reportes y Acceso. **Veintitrés hallazgos, dieciocho construidos**, cada uno reproducido contra la
API antes de tocar código.

**Los cinco que más pesan:**

1. **Un proveedor se desactivaba con mercancía en camino** y se le seguía recibiendo.
2. **«En camino» contaba los servicios** como mercancía esperada — y esa fila no se iba nunca,
   porque un servicio no se puede recibir.
3. **Lo reservado se calculaba en tres sitios con dos criterios**: la pantalla prometía cinco
   unidades y el sistema rechazaba un pedido de cinco.
4. **Un cliente se desactivaba con mercancía por salir** y se le seguía despachando.
5. **Una empresa podía quedarse sin nadie capaz de administrarla**: desactivarse estaba impedido,
   quitarse el propio rol no.

**Los cuatro patrones que esta tanda convirtió en método** (escritos en el playbook y en la skill):

- **El código que afirma una intención y no la cumple.** Cuatro veces: un comentario que decía
  «se redondea igual que en el dominio» y no era igual; otro que declaraba «la empresa se quedaría
  sin nadie» y sólo cubría un camino de dos; una invariante del estado de cuenta escrita en un
  comentario; y la documentación funcional del proveedor. **Un comentario que afirma algo es una
  afirmación verificable, no una explicación.**
- **El doble que se porta mejor que la base**, que hace pasar el contrato en verde.
- **La misma cifra calculada en varios sitios**, cinco apariciones.
- **El maestro que se cierra con documentos vivos**, tres: bodega, proveedor, cliente.

### Hecho el 19-sep-2026 · Compras y Ventas enteros, en dos revisiones **en lote**

Rafael pidió cambiar el método: auditar **todos los submódulos de un módulo en una sola pasada**,
anotar los hallazgos en un archivo, corregirlos de una vez y revalidarlos de una vez. Funcionó, con
un matiz que conviene recordar: **el ahorro está en la verificación** —una suite entera, una
reconstrucción de contenedores, una pasada de interfaz— **no en la auditoría**, que cuesta lo mismo.
Y lo que **no** se puede meter en el lote es reproducir: de los catorce candidatos de Compras, dos
no se sostuvieron al comprobarlos.

**Compras** ([revisión](revision/compras/compras.md)): trece hallazgos, once construidos. Los dos
graves: un proveedor se desactivaba con mercancía en camino **y se le seguía recibiendo**, y «En
camino» contaba los **servicios** como mercancía esperada —una fila que no se iba nunca, porque un
servicio no se puede recibir—.

**Ventas** ([revisión](revision/ventas/ventas.md)): seis hallazgos, cuatro construidos. El de
fondo: **lo reservado se calculaba en tres sitios con dos criterios**, así que la pantalla prometía
cinco unidades y el sistema rechazaba un pedido de cinco.

**El patrón que ya no es casualidad:** tres maestros con el mismo hueco —bodega, proveedor,
cliente—, encontrados con la misma pregunta: *¿qué le pasa a lo que ya lo usa cuando este maestro
se cierra?* Y tres falsos verdes del mismo tipo, que ahora están escritos en el playbook: **cuando
el doble en memoria se porta mejor que el adaptador real, el contrato pasa en verde**.

### El plan para cerrar el sistema al 100 % (acordado el 19-sep-2026)

Rafael fijó **este orden, y no se altera**:

| | Qué | Por qué en ese sitio |
|---|---|---|
| ~~1º~~ | ~~**Acceso**~~ — **cerrado el 19-sep-2026**, once hallazgos construidos de doce | Era el que tenía peso real, y lo confirmó: una empresa podía quedarse sin nadie que la administrara por tres puertas distintas |
| ~~2º~~ | ~~**Reportes**~~ — **cerrado el 19-sep-2026**, doce hallazgos construidos | El hallazgo anotado se confirmó y creció: el PDF no sólo redondeaba distinto, es que **sus filas no sumaban su propio total** |
| **3º** | **Las cuatro decisiones** que esperan a Rafael | Están abajo, cada una con su síntoma, su `archivo:línea` y su coste |
| **4º** | **Mejoras de diseño del sistema** | **Sólo después de cerrar el 100 %.** Textual: «eso será luego de cerrar al 100 el sistema como tal» |

#### 1º · Acceso — cerrado el 19-sep-2026

Doce hallazgos, **once construidos**. El informe completo está en
[`revision/acceso/acceso.md`](revision/acceso/acceso.md). Lo que cambió, en corto:

- **Una empresa ya no se queda sin nadie que la administre**, por ninguna de las tres puertas
  —editar sus roles, retirarle el rol, desactivarla— ni a manos de nadie. Antes bastaba una cuenta
  que **nunca fue administradora** para dejar Acme con cero administradores, y era irreversible.
- **`DELETE /roles/assignments` se saltaba entera** la guarda construida el día antes: el mismo acto
  daba 409 por una ruta y 200 por la otra. Ahora la regla vive en una política, en un solo sitio.
- **Nadie concede lo que no tiene, ni a sí mismo ni a otro**, en los cinco caminos que reparten
  acceso. La primera versión miraba sólo el caso propio y en dos caminos: quedaban abiertas dos
  puertas —ampliar el rol que uno lleva (de 3 a 89 permisos en una petición) y crear una cuenta
  títere con el rol de administrador—, que encontró la revisión adversarial.
- **Cambiar la contraseña cierra las sesiones abiertas**, con una fecha de corte por persona
  (`users.sessions_valid_from`), y devuelve una sesión nueva para que quien la cambió siga dentro.
- **El rol de administrador no se edita**: se le podía poner el nombre «Consulta basica» y seguía
  concediendo la empresa entera. Esa regla sólo existía en la pantalla.
- **Un rol concede al menos un permiso**, y los DTO de Acceso rechazan campos que antes ignoraban.
- **El bloqueo por intentos purga las entradas caducadas** y la ventana arranca de nuevo al
  bloquear. Contar además por dirección de red **se intentó y se retiró**: contando fallos
  castigaba a una oficina entera, y contando sólo las cuentas inexistentes se convertía en un
  oráculo —21 peticiones bastaban para saber si un correo está registrado—.
- **La cookie dura lo que dice la API**, en vez de un «1 hora» repetido a mano en la interfaz.
- **Dos peticiones a la vez ya no se saltan la guarda del administrador**: se turnan con un cerrojo
  por empresa, el mismo patrón que Ventas e Inventario usan para reservar existencia. Sin él, la
  empresa quedaba sin administrador 4 de cada 5 intentos.

**Ya comprobado y correcto**, para no volver a mirarlo: el tiempo de respuesta del inicio de sesión
no delata qué correos existen (29 ms con uno registrado contra 28 ms con uno inventado); el
aislamiento entre empresas responde 404 en los cinco caminos; `grantsAll` no se puede quitar
editando un rol; quitar un permiso surte efecto en la siguiente petición; ninguna ruta llega sin
declarar qué pide; y el cuerpo nunca acepta `tenantId`.

**Lo anotado sin construir**, en [`FUTURE.md`](FUTURE.md): que nadie pueda dejar fuera a otro a
propósito —bloquear su correo con cinco intentos sigue siendo posible, y cerrarlo del todo pide un
retardo creciente en vez de un bloqueo—, llevar el conteo fuera de la memoria del proceso, y poder
revocar una sesión concreta en vez de todas.

#### 2º · Reportes — cerrado el 19-sep-2026

Doce hallazgos, **todos construidos**: seis de leer y usar el módulo, y **seis de la revisión
adversarial** —cinco sobre código de ese mismo día y uno preexistente—. El informe completo está en
[`revision/reportes/reportes.md`](revision/reportes/reportes.md). Lo que cambió, en corto:

- **El PDF ya cuadra consigo mismo.** Fijaba dos decimales para los importes aunque la empresa puede
  configurar cuatro: dos filas de 1,006 salían «1,01» y «1,01» y el total 2,012 salía «2,01», así
  que lo que se veía sumaba 2,02 y el total decía otra cosa. Ahora los decimales viajan dentro del
  documento y los escriben igual la pantalla, el PDF y el Excel. **Ojo con la nota vieja**: decía
  que ninguna vía usaba `amountDecimals` y era inexacta —el SQL sí lo usaba; el formateo, no—.
- **El PDF de una bodega vacía decía «Todas las bodegas»**, con el total en cero: el nombre salía de
  la primera fila, y sin filas no había ninguna. Un papel que negaba el inventario de la empresa
  entera. El puerto pasó de responder «¿existe?» a «¿cómo se llama?».
- **Una sola notación numérica por documento.** La cabecera del estado de cuenta usaba `toFixed` y
  escribía `1000.00` frente al `1.000,00` de su propia tabla.
- **Los cuatro reportes paginan en pantalla y se exportan completos**, por decisión de Rafael. Los
  totales cubren todas las filas, nunca la página: hay una prueba que lo defiende, y se comprobó
  que falla si se calculan sobre la página.
- Las cuatro descargas de valuación ya no se llaman igual, y dos búsquedas lineales dentro de
  recorridos dejaron de serlo.

**Lo que destapó la revisión adversarial.** Lo más grave NO era de ese día: `report-renderer.ts`
bautizaba la hoja de Excel con el título del documento, y Excel prohíbe `* ? : \ / [ ]` en el
nombre de una hoja. **Un cliente llamado «Comercial A/B» hacía que su estado de cuenta en Excel
respondiera 500.** Llevaba ahí desde que existe el módulo.

Sobre código de ese mismo día: el estado de cuenta
**paginaba al revés de lo que rotulaba** —«1–2 de 5» enseñando las filas 4 y 5, y el saldo bajando
al pulsar *Siguientes*—; el paginador **desaparecía** si el desplazamiento se pasaba del total,
dejando una pantalla vacía sin enlace para volver; y un identificador **en mayúsculas** lo
encontraba PostgreSQL y no el doble en memoria. Este último se arregló en la raíz —`Uuid` normaliza
a minúsculas— así que alcanza a todos los contextos. **Es el quinto falso verde de esa familia en
el proyecto.**

**Ya comprobado y correcto**, para no volver a mirarlo: el valor del inventario coincide en
Existencias, el informe y el tablero; los dos saldos del estado de cuenta **no pueden** divergir
—se buscó el caso que los separaría y las dos puertas están cerradas—; la ruta de descarga del
navegador es una lista blanca de cuatro rutas; seis de las siete cifras del tablero excluyen
anulados y borradores; y «este mes» usa la zona horaria de la empresa.

**Dos sospechas que se cayeron al comprobarlas**, para que nadie las persiga otra vez: la antigüedad
**no** suma saldos negativos (`aging.ts:29` los descarta), y las consultas sin `ORDER BY` **no**
dan orden inestable, porque los casos de uso ordenan en memoria.

**La referencia no sirvió aquí**: `verlumyx/erp` no tiene módulo de reportes, y su tablero renderiza
una pantalla vacía sin una sola cifra. El contraste se apoyó entero en el sector.

### Qué sigue

**Continuar la revisión módulo por módulo con la skill `module-review`**, que es justo el método que salió de este
piloto. El orden y el estado están en [`revision/README.md`](revision/README.md) § Orden y estado.

**Cinco módulos cerrados enteros**: Catálogo, Inventario, Compras, Ventas y Cuentas por cobrar.

**Acceso dio el hallazgo más grave del día, aun con auditoría acotada:** una empresa podía quedarse
**sin nadie capaz de administrarla**. Desactivarse estaba impedido, pero **quitarse el propio rol
no**, y quien lo hacía se encerraba fuera en la misma sesión sin poder devolvérselo. El comentario
del error que sí existía declaraba textualmente ese riesgo —«la empresa se quedaría sin nadie capaz
de devolverle el acceso»— y sólo cubría un camino de dos. Construida la otra mitad
(`CannotDropOwnAdminRoleError`).

**Reportes y Acceso tienen una auditoría acotada, NO la revisión completa**
([informe](revision/reportes/reportes-y-acceso.md)). Se les hicieron las dos preguntas que esta
tanda demostró que rinden —¿alguna ruta responde distinto que sus gemelas?, ¿alguna cifra se
calcula en más de un sitio?— y encontraron un defecto. **Lo que no se miró está escrito**: de dónde
sale cada cifra del tablero y contra qué zona horaria calcula «este mes», qué pasa con las personas
cuando un rol pierde un permiso, la caducidad de la sesión, y si las exportaciones a PDF y Excel
usan el mismo cálculo que la pantalla. **Ese es el siguiente trabajo.**

**Dos avisos para quien lo retome**, salidos de estas dos tandas:

- **Los listados de Cuentas por cobrar, Reportes y Acceso casi seguro tampoco paginan.** Es el
  primer sitio donde mirar, y el arreglo ya tiene patrón en `purchasing` y `sales`.
- **Al paginar, los ayudantes de `apps/e2e/support/*-fixtures.ts` se rompen**, porque crean un
  registro y luego lo buscan en el listado entero. La corrección es que **pidan el suyo** con un
  filtro, no subir el límite.

**Cómo arrancar el siguiente:** invocar la skill `module-review`, decirle qué submódulo se revisa y que el sistema de
referencia es `verlumyx/erp`. Para leerlo, **clonarlo es mucho más rápido que ir archivo por archivo**:
`gh repo clone verlumyx/erp /tmp/verlumyx --  --depth 1`, y después `grep -rn` sobre `app/Modules/`. Así se encontró en
un minuto que su FIFO no existe. Su búsqueda de código por API (`gh api search/code`) **no funciona** en ese repositorio.
Proveedores es **módulo sin revisar**: etapa 2 completa y matriz.

**Tres cosas que esta tanda de revisiones dejó como costumbre:**

- **La lupa de la interfaz.** Para la pasada de «recorrer las pantallas», escribir una prueba desechable de Playwright
  que inicie sesión con la cuenta de demostración, navegue y **guarde capturas**, y después mirarlas. Encontró dos
  defectos de presentación que ninguna prueba podía. Se borra al terminar.
- **Al paginar un listado, las pruebas que daban por hecho verlo todo fallan, y está bien.** No subir el límite para
  que vuelvan a pasar: cambiarlas para que **busquen su registro**. Los ayudantes de e2e ya lo hacen con `q=<sku>`.
- **Reconstruir los contenedores (`make up`) tras tocar código, y esperar a que termine** antes de correr end-to-end.
  Tres veces en esta sesión corrí contra la imagen vieja y el fallo no tenía sentido.

**Hecho el 19-sep-2026 · Inventario › Kardex** ([revisión](revision/inventario/kardex.md)): cuatro hallazgos. El kardex
se devolvía entero, sin filtros: ahora pagina, filtra por bodega, por tipo de documento y por rango de fechas, y se lee
**del más reciente al más antiguo**. Y se cerró el tema del **método de costo**: sigue el promedio ponderado y sólo ese,
porque FIFO no es un campo sino otro motor, y porque el sistema de referencia declara tres métodos y su `cost_method`
sólo se lee en dos sitios, los dos comparando con `'standard'` — **su FIFO es una etiqueta que no hace nada**.

**Hecho el 19-sep-2026 · Inventario › Existencias** ([revisión](revision/inventario/existencias.md)): cinco hallazgos.
El de fondo: la pantalla decía **cuánto hay, no cuánto se puede prometer** —288 unidades de agua, 72 comprometidas en
pedidos confirmados, y el dato ya se calculaba para Bajo mínimo desde la fase 4 sin llegar aquí—. También, el mismo
inventario **valía dos cosas distintas** según se mirara la pantalla (céntimos fijos) o el informe de valuación (los
decimales de la empresa): reproducido, 0,37 contra 0,3704.

**Hecho el 19-sep-2026 · Inventario › Ajustes** ([revisión](revision/inventario/ajustes.md)): siete hallazgos, el
grave que **una entrada sin costo en una bodega vacía entraba valorada en cero** —y ese cero se quedaba, así que toda
salida posterior salía gratis—. La referencia lo resuelve con el promedio del maestro de artículos y nosotros no.
También: la **fecha del documento no llegaba al kardex** (transversal a los tres documentos que mueven existencia), el
ajuste **no decía por qué se hacía**, no había forma de **corregir un costo equivocado**, el listado traía todos los
ajustes de la empresa, y **ningún documento guardaba quién lo hizo**. Se construyeron los seis, más la limpieza de
seis citas por nombre al sistema privado del empleo que estaban en documentación pública.

**Hecho el 18-sep-2026 · el Catálogo entero** ([revisión](revision/catalogo/catalogo.md)): cuatro hallazgos, el
grave que una bodega se podía cerrar con una orden de compra esperando entrar en ella. Se decidió dejar las
categorías planas con el porqué escrito, marcar las unidades que no admiten decimales, y sacar la **retención de
impuestos como hito propio** —el ERP de referencia la tiene a medias: no descuenta del total, no descuenta del
saldo y no emite comprobante— con su alcance en [FUTURE.md](FUTURE.md).

**Hecho el 18-sep-2026 · la fase 4 de Artículos**, que era el flanco abierto del piloto: se había construido sin
revisión adversarial propia. La revisión, la primera hecha **con la skill**, encontró seis cosas
([revisión §12](revision/inventario/articulos.md)), dos de ellas graves: el factor de ocho decimales **no llegaba
al cálculo** —la fase 4 lo daba por corregido— y la paginación **escondía artículos** con nombres repetidos. Vale
como aviso: una fase cerrada sin lupa propia no está revisada aunque su suite esté verde.

**Al arrancar:** invocar la skill `module-review`, decirle qué submódulo se revisa y que el sistema de referencia es
`verlumyx/erp` (se lee con `gh api repos/verlumyx/erp/contents/<ruta> --jq '.content' | base64 -d`; **leer su código,
no solo su documentación**). La skill ya trae los dos modos: Ajustes es **módulo sin revisar**, así que etapa 2
completa y matriz.

**La pregunta que más rinde en un maestro**, y que salió del Catálogo: *¿qué le pasa a lo que ya lo usa cuando este
maestro se cierra o cambia?* El mismo hueco reaparece en unos maestros y no en otros.

**Hecho el 19-sep-2026 · las tres revisiones de Inventario, en una sesión autónoma.** Rafael pidió aplicar todo lo
recomendado sin preguntar. Se cerraron **Ajustes** (8 hallazgos), **Existencias** (5) y **Kardex** (4), más la
limpieza de seis citas por nombre al sistema privado del empleo que estaban en documentación pública. Cada decisión
tomada sin él está escrita con su porqué en el informe de su submódulo, incluidas las de **no construir**: FIFO y costo
estándar, el tipo «no inventariado», la aprobación por umbral, el conteo físico como documento propio y el rastro de
autor en los otros seis documentos.

### Decisiones esperando a Rafael

Ninguna bloquea el trabajo. Cada una trae lo que hace falta para decidirla sin releer nada más.

**0. El cliente de contado se salta las dos protecciones de crédito.** *(abierta el 19-sep-2026, en
la revisión de Cuentas por cobrar — [informe § C3](revision/cuentas-por-cobrar/cuentas-por-cobrar.md))*

Reproducido: a un cliente con plazo 0 y **límite de crédito 1** se le emitió una factura de
**98,60** sin una queja. La línea `if (paymentTermDays === 0) return` (`customer-credit.ts:18`) sale
antes de las dos comprobaciones, así que se salta el límite **y el bloqueo por facturas vencidas**.

- **No se construyó porque cambia lo que el negocio puede hacer**, no arregla un cálculo: forzar el
  control bloquearía la venta de mostrador, donde se factura y se cobra en el mismo acto.
- **Las dos lecturas son razonables.** Que un contado no consuma crédito tiene sentido; que un
  `creditLimit` puesto a mano se ignore **en silencio** es justo lo que este proyecto le ha
  reprochado tres veces al sistema de referencia.
- **Recomendación, si quieres una:** aplicar siempre el bloqueo por **facturas vencidas** —eso no
  tiene nada que ver con el plazo y es la mitad difícil de defender— y dejar el límite como está.
  Una línea y una prueba.

**1. La carrera entre desactivar una bodega y publicar en ella.** *(abierta el 19-sep-2026, en la revisión de Ajustes)*

El Catálogo construyó la regla «una bodega no se desactiva si tiene existencia o documentos abiertos». Bajo
concurrencia se rompe: `WarehouseStatusChanger` pregunta por la existencia **fuera de toda transacción y sin bloquear
la bodega** (`change-warehouse-status/warehouse-status-changer.ts:36-44`), y la publicación de un ajuste, una entrada o
un despacho **no bloquea ni revisa la bodega** dentro de la suya —la comprueba antes, al revalidar el borrador—.
Interleadas, una bodega vacía se desactiva mientras un ajuste le mete mercancía: queda **existencia en una bodega
inactiva**, que es el estado que la regla existe para impedir.

- **Por qué no se construyó:** es transversal —toca Catálogo e Inventario— y reabre dos módulos ya cerrados. Ventana
  estrecha y sin impacto conocido, pero es una invariante que el sistema dice mantener.
- **Qué costaría:** dos mitades. En el inventario, bloquear la bodega en modo compartido dentro de `lockedLedger`
  —donde ya se bloquean los artículos— y comprobar ahí que sigue activa; es **un solo sitio**, porque los tres
  documentos que mueven existencia pasan por él. En el catálogo, envolver la desactivación en una transacción que
  bloquee la bodega con `FOR UPDATE` antes de preguntar. **Con una sola mitad la ventana se estrecha pero no se cierra.**
- Alcance completo en [FUTURE.md](FUTURE.md) § «Cerrar la carrera entre desactivar una bodega y publicar en ella».

**2. La tasa de fines de semana y feriados.** *(abierta desde la fase 3)*

[`revision/temas/configuracion-empresa.md`](revision/temas/configuracion-empresa.md) §10.3, punto 1.

**3. Revisar, si quieres, el motivo obligatorio del ajuste.** *(construido; el dato que lo sostenía era falso)*

Se construyó con los ocho tipos del sistema de referencia y **está funcionando**. Pero la cifra del sector que lo
justificaba en parte era mía y estaba mal: escribí «3 de 4 lo exigen» tras mirar tres productos por encima. La
investigación a fondo sobre **seis** productos dice que **sólo uno lo exige** (Zoho), dos tienen catálogo (Zoho y
Business Central) y tres —ERPNext, SAP y NetSuite— **no tienen ni el campo**. Lo que cinco de seis sí exigen es la
**cuenta contable de contrapartida**, que aquí no aplica porque no llevamos contabilidad.

- **La decisión sigue siendo defendible** por dos razones que no dependen del sector: el sistema de referencia lo pide
  por partida doble —un `type` tipificado y un `reason` de texto obligatorio, con el comentario «un ajuste sin motivo
  no se registra»—, y sin él ningún informe puede separar cuánto se perdió por merma de cuánto se corrigió por conteo.
- La cifra ya está **corregida donde se escribió** ([revisión de Ajustes §2](revision/inventario/ajustes.md)), y el
  informe dice ahora que es una decisión tomada **a pesar** del consenso, no gracias a él.
- **Deshacerla costaría poco** si prefieres: quitar la obligatoriedad es relajar una columna; quitar los tipos ya no,
  porque la revaluación cuelga de ellos.

**Decisiones de Rafael que no hay que volver a discutir:**

- **Retención de impuestos**: se hace **completa y como hito propio**, no como un campo del impuesto. Alcance en
  [FUTURE.md](FUTURE.md). Se descartó copiar el campo del ERP de referencia: leyendo su código, su retención no
  descuenta del total, no descuenta del saldo y no emite comprobante, y además la retención depende de **quién
  compra**, no del impuesto
- **Categorías**: planas, un solo nivel, con el porqué y las fuentes comparadas escritas en
  [modulos/catalogo.md](modulos/catalogo.md). No se vuelve a plantear la jerarquía
- **Campos de la bodega**: ninguno nuevo. Un campo se añade cuando existe el flujo que lo consume, no porque otro
  sistema lo tenga ([revisión del catálogo §4](revision/catalogo/catalogo.md))
- Artículos va bajo **Inventario**, también el código («con hexagonal es más sencillo migrar todo»)
- Listas de precio y configuración de la empresa **se hacen ahora**, investigando antes dónde van
- **Borradores**: no cuentan como documento abierto; uno cuya caja cambió no se confirma en silencio
- **Adjuntos e imágenes**: tabla de adjuntos (empresa, tipo y id del registro, clave, nombre original,
  tipo MIME, tamaño, quién subió) y puerto `FileStorage` con adaptador de disco (crea la carpeta si no
  existe) y adaptador S3 (Supabase Storage), elegido por variable de entorno. Se sirve por la API, no
  desde una carpeta pública. Pendiente de construir en su fase
- Peso, volumen e imagen del artículo: la imagen espera al módulo de adjuntos
- No inventariado, lotes, series y método de costo se investigan en Inventario; el contexto del despacho,
  en Ventas › Despachos

**Herramientas de la revisión:**

- Reproducir contra la API local con un script de Node fuera del repositorio (`fetch` a
  `localhost:3001`, sesión de `ana@acme.com`); ver los casos de la sección 9.1 del informe
- `agy` como segunda opinión: adjuntar el diff con `@archivo` y usar `--print-timeout 20m`; con el tiempo
  por defecto (5 min) se corta sin responder. **Verificar cada punto antes de aceptarlo**: en esta ronda
  cuatro de cinco no se sostuvieron
- Las pruebas de contrato vacían la base de desarrollo; `make seed` (o la suite e2e) la vuelve a sembrar
- **Exploraciones en paralelo, una por área**, exigiendo `archivo:línea` en cada afirmación y prohibiendo opinar.
  Es lo que convierte medio día de lectura en dos minutos. Marca siempre una pregunta como la más importante, con
  esta forma: *lista todos los caminos que hacen X y di explícitamente cuáles no comprueban Y*
- **La suite entera cuesta entre cinco y quince minutos**: se corre al terminar todos los hallazgos y antes de
  commitear, no después de cada arreglo. Para un hallazgo suelto basta su archivo, más el contrato si se tocó un
  puerto o una consulta
- **Ante un fallo raro, mira el `load average` antes que el código.** Con la máquina cargada, alguna prueba de
  aislamiento cae con `socket hang up` en una ruta pesada; con la máquina libre pasan las 377. Comprobado
- **Al esperar a que algo termine, no uses `until ! pgrep -f "<cadena>"`**: el propio comando de espera contiene
  esa cadena, se encuentra a sí mismo y el bucle no sale nunca

## Comandos

```bash
make help           lista todo
make up             levanta el sistema y aplica migraciones
make verify         todo lo que corre el CI — antes de cada push
make verify-clean   igual, simulando un clon limpio
make migrate        aplica migraciones pendientes
make report         abre el reporte de Playwright
```

---

## Deudas anotadas

Ninguna urgente. Todas en [`docs/FUTURE.md`](FUTURE.md), más:

- TypeScript 6 en la API contra 5.9 en la web — alinear al crear `packages/contracts`
- El playbook necesita exponerse como skill invocable
