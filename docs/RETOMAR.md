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
| Pruebas | 338 unitarias · 33 de contrato · 35 end-to-end |
| **H0 — Fundación** | **Completado** |
| **H1 — Multiempresa y acceso** | Fases 0 a 6 hechas; **siguiente: fase 7** |

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
- Una membresía revocada responde `InvalidCredentialsError` si no se pidió empresa, y
  `InactiveMembershipError` si se pidió por slug: quien ya sabe que la empresa existe
  merece saber que le revocaron el acceso
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

### Fase 7 — Frontend

Login, cookie `httpOnly` puesta por una acción de servidor, ruta protegida y selector de
empresa. Lógica en `modules/access/`, componentes en `sections/`.

### Fase 8 — Pruebas end-to-end

POM de login reutilizable. Y las **pruebas de aislamiento entre empresas**: la empresa A
intenta leer, editar y borrar datos de la B, y rebota en los tres casos con 404.

### Fase 9 — Semillas

Dos empresas con datos, sus roles y el superusuario con membresía en ambas. Son
imprescindibles para poder probar el aislamiento.

### Fase 10 — Cierre

Ajustar `docs/ARCHITECTURE.md` con lo aprendido, y **extraer las skills** (`nest-hexagonal`,
`frontend-hexagonal`, `nexora-testing`) más los patrones al
[playbook](https://github.com/Rafarars/engineering-playbook), cuya carpeta `patterns/`
está vacía esperando esto.

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
