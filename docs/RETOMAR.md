# Estado y siguientes pasos

Documento de traspaso: contiene lo necesario para continuar el proyecto **sin depender
de ninguna conversación anterior**.

**Actualizado:** 10 de septiembre de 2026

---

## Cómo retomar

1. Leer [`AGENTS.md`](../AGENTS.md) — reglas del proyecto
2. Leer [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — convención hexagonal
3. Buscar en Engram, proyecto `nexora-erp`, para el porqué de cada decisión
4. `make up` y `make verify` para confirmar que todo sigue en verde

---

## Dónde estamos

| | |
|---|---|
| Repositorio | github.com/Rafarars/nexora-erp |
| Reporte de pruebas | https://rafarars.github.io/nexora-erp/ |
| Pruebas | 511 + 28 unitarias · 33 de contrato · 105 end-to-end |
| **H0 — Fundación** | **Completado** |
| **H1 — Multiempresa y acceso** | **Completado** y revisado; siguiente: H2 |

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
- **Listados con menú «Opciones» por fila**, como Flexio: Editar abre el mismo panel del
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
  existe una `hexagonal-architecture` de Flexio (PHP): elegir nombres que no choquen

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
