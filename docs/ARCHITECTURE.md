# Arquitectura

Arquitectura hexagonal (puertos y adaptadores) con rebanado vertical, adaptada a
TypeScript desde la convención que el equipo ya usa en producción.

## La regla de oro

Sirve como prueba de fuego para saber si un archivo está en la capa correcta:

> **En `domain/` y `application/`, cada `import` debe apuntar a código propio.**
> Ni frameworks, ni clientes HTTP, ni librerías de terceros. Si ves
> `import { Injectable } from '@nestjs/common'` en el dominio, está mal ubicado.

Los imports externos viven en `infrastructure/`. Sin excepciones.

## Rebanado vertical

Las funcionalidades van arriba y las capas dentro de cada una — nunca al revés:

```
contexts/
  access/
    domain/
    application/
    infrastructure/
  inventory/
    domain/
    ...
```

Poner `domain/`, `application/` e `infrastructure/` en el nivel superior y las
funcionalidades dentro es **rebanado vertical falso**: se trabaja sobre
funcionalidades, no sobre capas. Además, así un contexto se promueve a módulo
independiente arrastrando una sola carpeta.

## Arquitectura que grita

Dentro de `application/`, las carpetas se nombran por **lo que el sistema hace**, no
por el rol técnico de las clases:

```
application/
  authenticate-user/     ✅ dice qué hace
  create-user/
  search-users/

application/
  handlers/              ❌ dice qué es
  use-cases/
  dtos/
```

Al abrir `application/` de un contexto se ven todas sus capacidades.

---

# Backend (NestJS)

```
apps/api/src/
├── contexts/
│   └── access/
│       ├── domain/
│       │   ├── user.entity.ts                 class User
│       │   ├── user.repository.ts             PUERTO: interfaz + Symbol
│       │   ├── email.vo.ts                    class Email
│       │   ├── errors/
│       │   │   └── user-not-found.error.ts
│       │   └── find/
│       │       └── user-finder.ts             servicio de dominio (opcional)
│       ├── application/
│       │   ├── authenticate-user/
│       │   │   ├── user-authenticator.ts
│       │   │   ├── user-authenticator.request.ts
│       │   │   └── user-authenticator.response.ts
│       │   └── create-user/
│       │       ├── user-creator.ts
│       │       └── user-creator.request.ts
│       └── infrastructure/
│           ├── http/
│           │   ├── login-post.controller.ts   un controlador POR ACCIÓN
│           │   └── dto/
│           ├── persistence/
│           │   └── prisma-user.repository.ts  ADAPTADOR
│           ├── security/
│           │   └── argon2-password-hasher.ts
│           └── access.module.ts               el cableado
└── shared/
    ├── config/
    ├── prisma/
    └── domain/                                DomainError, ValueObject
```

## Nombres

| Elemento | Archivo | Clase |
|---|---|---|
| Entidad | `user.entity.ts` | `User` |
| Value object | `email.vo.ts` | `Email` |
| Puerto | `user.repository.ts` | `interface UserRepository` + `USER_REPOSITORY` |
| Caso de uso | `user-creator.ts` | `UserCreator` |
| DTO de entrada | `user-creator.request.ts` | `UserCreatorRequest` |
| DTO de salida | `user-finder.response.ts` | `UserFinderResponse` |
| Error de dominio | `user-not-found.error.ts` | `UserNotFoundError` |
| Adaptador | `prisma-user.repository.ts` | `PrismaUserRepository` |
| Controlador | `login-post.controller.ts` | `LoginPostController` |

**Archivos en kebab-case** (convención de NestJS), **clases en PascalCase**.

Los casos de uso se nombran por su acción, no con el sufijo `UseCase`:
`UserCreator`, `UserFinder`, `UserSearcher`, `UserUpdater`, `UserDeleter`. La carpeta
`application/` ya dice que son casos de uso.

## Tipos de caso de uso

| Tipo | Sufijo | Devuelve | HTTP |
|---|---|---|---|
| Crear | `Creator` | `void` | 201 |
| Buscar uno | `Finder` | DTO de respuesta | 200 |
| Listar | `Searcher` | DTO de colección | 200 |
| Actualizar | `Updater` | `void` | 200 |
| Eliminar | `Deleter` | `void` | 204 |

Todos exponen un único método `run()`.

## Entidades

```ts
export class User {
  private constructor(
    private readonly id: UserId,
    private readonly tenantId: TenantId,
    private email: Email,
  ) {}

  static create(...): User { ... }          // instancia NUEVA
  static fromPrimitives(row: ...): User { } // reconstruir desde la base
  toPrimitives(): ... { }                   // serializar para la base
  changeEmail(email: Email): void { }       // mutación con nombre de negocio
}
```

Nunca un `new` público: se crean con fábricas estáticas. Los value objects validan en
su constructor.

## Puertos

```ts
export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository {
  save(user: User): Promise<void>;
  find(tenantId: TenantId, id: UserId): Promise<User | null>;
  search(tenantId: TenantId, filters: ...): Promise<User[]>;
}
```

**El `TenantId` es obligatorio en la firma.** Si se olvida el filtro por empresa, el
proyecto no compila: el aislamiento lo garantiza el sistema de tipos, no la disciplina.

El token (`Symbol`) es necesario porque las interfaces de TypeScript **se borran al
compilar** y el contenedor de NestJS no puede resolverlas por tipo. Equivale al nombre
de servicio de `services.yaml` en Symfony.

`find()` devuelve `null` cuando no encuentra; quien lanza la excepción es el servicio
de dominio o el caso de uso.

## Servicios de dominio

Cuando una regla de negocio necesita un repositorio, vive en un servicio de dominio con
nombre de negocio, no en un `if` dentro del caso de uso:

```
domain/
  tenant/find/tenant-finder.ts        el repositorio devuelve null; el finder lanza
  user/register/user-registrar.ts     un correo ya registrado reutiliza a la persona
  membership/enroll/member-enroller.ts  nadie entra dos veces a la misma empresa
```

El caso de uso **ordena**; las reglas viven en el dominio. Un finder de dominio devuelve
la entidad y sirve a otros casos de uso; un `Finder` de aplicación devuelve un DTO y
sirve a un endpoint. Tienen el mismo nombre y trabajos distintos.

## Autorización

Guardián global que **deniega por defecto**. Cada ruta declara una de tres cosas, y lo
que no declara nada responde 403:

| Declaración | Para |
|---|---|
| `@Public()` | Sin sesión: `login`, `/health` |
| `@AuthenticatedOnly()` | Sesión válida y ningún permiso concreto: perfil, cambio de empresa |
| `@RequirePermission('access.users.create')` | Un permiso concreto |

- **El guardián consulta la base en cada petición**, no los permisos del token: quitar
  un permiso tiene efecto inmediato
- **Dos declaraciones a la vez cierran.** Los decoradores de clase y de método conviven:
  un `@Public()` en la clase no debe abrir un método que exige permiso
- **Qué permisos existen es código** (`permissions.catalog.ts`, sincronizado por
  `make migrate`); **quién los tiene es base de datos**, editable desde la interfaz
- `route-declaration.spec.ts` recorre todas las rutas y exige que declaren algo, y cruza
  los `@RequirePermission` con el catálogo en ambas direcciones

## Errores

El dominio lanza errores de dominio, y un filtro de excepciones los traduce a códigos
HTTP. **El dominio nunca sabe qué es un 404.** Así el mismo caso de uso sirve para una
tarea programada o una cola sin arrastrar HTTP.

---

# Frontend (Next.js)

```
apps/web/src/
├── app/                     rutas de Next: composición y acciones de servidor
│   ├── login/
│   ├── estado/              público: se consulta cuando el sistema está caído
│   └── (app)/               todo lo que exige sesión
│       ├── administracion/{usuarios,roles}/   page.tsx + actions.ts
│       └── perfil/
├── sections/                componentes, por pantalla
├── modules/                 LÓGICA — sin React
│   └── access/
│       ├── domain/          modelo propio y puerto AccessApi
│       └── infrastructure/  HttpAccessApi y su doble en memoria
└── shared/
    ├── session/             cookie httpOnly y sesión actual
    └── forms/
```

**Las acciones de servidor son la capa de aplicación del frontend.** Llaman al puerto,
traducen el error a un mensaje para la persona y revalidan la ruta. Por eso no existe
`modules/*/application/`.

## Sesión

El token vive en una **cookie `httpOnly`** que pone una acción de servidor: ningún
JavaScript de la página puede leerlo. En cada navegación se pide `/auth/me` en vez de
confiar en lo guardado al entrar: si a alguien le quitan un rol, la siguiente pantalla
ya lo refleja.

## Navegación

La barra lateral es **solo para los módulos del negocio**. La administración de la
empresa y el perfil viven en el menú del nombre, al pie. Los listados llevan un menú
**Opciones** por fila; Editar abre el mismo panel lateral del alta ya relleno.

**`modules/` no sabe que existe React.** Son clases y funciones puras, probables con
Vitest sin montar un componente.

## La concesión de los componentes

Un componente de React es **estructuralmente infraestructura** —importa React, usa
hooks— pero se trata como capa de aplicación. Es una fuga aceptada a propósito: el
beneficio en pruebas y mantenibilidad compensa la impureza.

Lo que **no** se negocia: la lógica de negocio no vive en el componente. El componente
llama a un caso de uso de `modules/` y transforma tipos de dominio en props.

## Tipos por frontera

Los tipos del dominio **no espejan** los de la API, aunque hoy tengan la misma forma:

| Capa | De quién es el tipo |
|---|---|
| Infrastructure | La forma que devuelve la API |
| Domain | El modelo propio |
| UI | Las props que espera el componente |

El adaptador traduce de API a dominio; el componente traduce de dominio a props.
Formas hoy idénticas divergen mañana, y para entonces la traducción ya existe.

---

# Pruebas por capa

| Capa | Herramienta | ¿Necesita base de datos? |
|---|---|---|
| Dominio | Vitest | **No** |
| Aplicación | Vitest, con repositorios en memoria | **No** |
| Contrato de puerto | Vitest | Sí — la misma suite contra el doble y contra Prisma |
| Infraestructura HTTP | Playwright (proyecto `api`) | Sí |
| Interfaz | Playwright (proyecto `ui`) | Sí |
| Aislamiento entre empresas | Playwright (proyecto `isolation`) | Sí |
| Resiliencia | Playwright (proyecto `resilience`, al final) | Apaga la base |

## Pruebas de propiedad

No verifican una funcionalidad, verifican que **una regla se cumple en todo el
sistema**, y fallan el día que alguien la rompe:

| Prueba | Propiedad |
|---|---|
| `architecture.spec.ts` | `domain/` y `application/` no importan nada externo ni de capas exteriores |
| `route-declaration.spec.ts` | Toda ruta declara quién la alcanza; decoradores y catálogo cuadran |
| `error-categories.spec.ts` | Cada error hereda de su categoría, o saldría 500 |
| `isolation-coverage.spec.ts` | Todo endpoint que recibe un identificador tiene su ataque de aislamiento |

**Cada una se comprobó contra falso verde** introduciendo a mano la infracción que
existe para detectar. Una prueba que vigila el sistema entero y falla en silencio es
peor que no tenerla.

Que las pruebas de dominio y aplicación corran sin infraestructura **es la verificación
de que la arquitectura está bien hecha**. Si necesitan base de datos, algo se filtró.

---

# Antipatrones

| Mal | Bien |
|---|---|
| `import { Injectable } from '@nestjs/common'` en `domain/` | El dominio no importa frameworks |
| La palabra `prisma` fuera de `infrastructure/` | Solo en adaptadores |
| Devolver `null` desde un caso de uso cuando no encuentra | Lanzar un error de dominio |
| Un controlador con seis métodos | Un controlador por acción |
| Exponer la entidad de dominio en la respuesta HTTP | DTO de respuesta |
| Un repositorio sin `TenantId` en la firma | Obligatorio en cada método |
| `new User(...)` desde fuera | `User.create(...)` o `User.fromPrimitives(...)` |
| Carpetas `handlers/`, `dtos/`, `use-cases/` | Carpetas por acción: `create-user/` |
| `@UsePipes(new ZodValidationPipe(...))` en el método | En el parámetro: `@Body(new ZodValidationPipe(...))`. En el método valida también `@Session()` |
| Comprobar `@Public()` primero y salir | Leer todas las declaraciones antes de decidir |
| El administrador cambia la contraseña de otra persona | Solo la propia persona: la cuenta abre todas sus empresas |
| Solo una aserción negativa (`toHaveCount(0)`) | Antes, una positiva que confirme que se está en la página correcta |
| Imports relativos con `.js` en el frontend | Sin extensión en Next; con `.js` en la API (`nodenext`) |
| Exportar constantes o funciones síncronas desde `'use server'` | Solo funciones async; lo demás, en otro archivo |

---

*Convención adaptada de los cursos de Codely (arquitectura hexagonal, hexagonal en
frontend, rebanado vertical) y de la implementación del equipo en PHP/Symfony.*
