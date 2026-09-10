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
| Pruebas | 14 unitarias · 10 end-to-end |
| **H0 — Fundación** | **Completado** |
| **H1 — Multiempresa y acceso** | Fases 0 y 1 hechas; **siguiente: fase 2** |

Lo que ya funciona: monorepo con API, frontend y suite E2E; PostgreSQL en Docker;
endpoint de salud que verifica la base; CI con cuatro trabajos publicando el reporte;
configuración validada al arrancar; Makefile con `verify` y `verify-clean`; convención
de arquitectura escrita; primitivas de dominio; y el esquema de acceso con su migración.

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

### Fase 2 — Dominio

```
contexts/access/domain/
├── tenant/      Tenant, TenantId, TenantRepository
├── user/        User, UserId, Email, PasswordHash, UserRepository
├── membership/  Membership, MembershipId, MembershipRepository
├── role/        Role, RoleId, PermissionCode, RoleRepository
└── errors/
```

Reglas de negocio que deben vivir en el dominio, cada una con su prueba:

- Un correo tiene que ser un correo — validado en el value object, no en un `if` suelto
- Una membresía inactiva no autentica
- Una empresa inactiva bloquea a todos sus miembros
- Un rol con `grantsAll` concede cualquier permiso **de su empresa**

Entidades con `create()`, `fromPrimitives()`, `toPrimitives()` y `changeX()`. Nunca
`new` público. Puertos como interfaz más token `Symbol`.

**Criterio de cierre:** las pruebas corren **sin base de datos, sin Docker y sin NestJS**.
Verificar que `domain/` no tiene ni un import externo.

### Fase 3 — Aplicación

Casos de uso en `application/<accion>/`, con repositorios **en memoria** en las pruebas.
Nombres por acción: `UserAuthenticator`, `TenantCreator`, `UserFinder`. Método único `run()`.

Casos de uso del H1: autenticar, cambiar de empresa, crear usuario, asignar rol, listar
usuarios de una empresa.

**Criterio de cierre:** también sin base de datos.

### Fase 4 — Infraestructura

Repositorios Prisma en `infrastructure/persistence/`, nombrados `PrismaUserRepository`.

**La pieza que más vende del portafolio: pruebas de contrato de puerto.** Una sola suite
ejecutada **dos veces** — contra el doble en memoria y contra el adaptador Prisma —
demostrando que se comportan igual.

### Fase 5 — Autenticación

Argon2 como adaptador del puerto `PasswordHasher`. Emisión de token como adaptador de
`TokenIssuer`. Endpoints `POST /api/v1/auth/login` y `POST /api/v1/auth/switch-tenant`.

El token lleva: identificador de usuario, `tenantId` activo y permisos.

### Fase 6 — Guardianes

Decorador `@RequirePermission('...')` y guardián global que **deniega si no hay
declaración**. El `tenantId` se lee del token y se pasa explícitamente al caso de uso.

**Prueba destacada:** una que recorre **todas las rutas registradas** y verifica que cada
una declara un permiso o está marcada como pública. No verifica una funcionalidad,
verifica una propiedad del sistema entero.

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
