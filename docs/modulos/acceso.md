# Acceso y administración

Quién entra, a qué empresa y qué puede hacer. Es el único módulo que conoce personas, empresas
y permisos; los demás solo nombran el permiso que exigen.

Contexto: `apps/api/src/contexts/access` · Pantallas: `/login`, `/perfil`, `/administracion/*`

| Submódulo | Tabla | Qué es |
|---|---|---|
| Empresas | `tenants` | Cada empresa que usa el sistema |
| Personas | `users` | Una cuenta por correo, **sin empresa** |
| Membresías | `memberships` | Une una persona con una empresa |
| Roles | `roles`, `role_permissions` | Conjuntos de permisos, por empresa |
| Asignaciones | `membership_roles` | Qué roles tiene cada membresía |
| Permisos | `permissions` | Catálogo global, identificado por código |

---

## 1. Modelo

- **`users` no lleva `tenant_id`.** Una persona tiene un correo único global y puede estar en
  varias empresas (la contadora de Acme y Globex es una sola cuenta).
- La **membresía** ata persona y empresa, y tiene su propio estado: desactivar a alguien en una
  empresa no lo saca de las demás.
- Los **roles son por empresa** y se asignan a la membresía: se puede ser administradora en una
  y solo lectura en otra.
- Un rol con **`grants_all`** concede todos los permisos **dentro de su empresa**, incluidos los
  que se creen en el futuro. Es el rol Administrador.
- **Superusuario sin atajos**: es una persona con membresía de administrador en cada empresa.
  Ningún código lo trata distinto.

---

## 2. Sesión

**Entrar** (`POST /api/v1/auth/login`, público)

- Con correo y contraseña. Opcionalmente, el `slug` de una empresa.
- Responde un token con la persona y la **empresa activa** (la primera membresía activa, o la
  pedida).
- Reglas:
  - Correo inexistente o contraseña incorrecta: siempre `InvalidCredentialsError` (401), con el
    **mismo tiempo de respuesta**, para no revelar qué correos existen.
  - **5 fallos por correo bloquean 15 minutos** (`TooManyLoginAttemptsError`, 429), también
    para correos inexistentes.
  - Contraseña correcta pero ninguna membresía activa: `NoActiveMembershipError` (401). A esa
    rama solo llega el dueño de la cuenta, así que decírselo no da pistas.
  - Persona, empresa o membresía inactivas no entran.

**Cambiar de empresa** (`POST /api/v1/auth/switch-tenant`, autenticado)

- Verifica la membresía activa en la empresa pedida y **reemite el token**. La empresa activa la
  firma el servidor.

**Quién soy** (`GET /api/v1/auth/me`)

- La interfaz lo pide en cada navegación: si a alguien le quitan un rol, la siguiente pantalla ya
  lo refleja.

**Token**: JWT firmado con `JWT_SECRET`, algoritmo fijo, una hora. En el navegador vive en una
**cookie `httpOnly`**; ningún JavaScript de la página puede leerlo.

---

## 3. Personas de la empresa

| Acción | Ruta | Permiso |
|---|---|---|
| Listar | `GET /api/v1/users` | `access.users.search` |
| Dar de alta | `POST /api/v1/users` | `access.users.create` |
| Editar nombre y roles | `PUT /api/v1/users/:userId` | `access.users.update` |
| Desactivar o reactivar | `PUT /api/v1/users/:userId/status` | `access.users.deactivate` |

**Reglas**

- Dar de alta con un correo **que ya existe** en el sistema reutiliza a esa persona y le crea la
  membresía; no se crea una segunda cuenta. Nadie entra dos veces a la misma empresa.
- Contraseña de **al menos 8 caracteres** (regla del dominio).
- Un administrador **nunca cambia el correo ni la contraseña de otra persona**: la cuenta abre
  todas sus empresas, y cambiarle la llave daría acceso a las otras.
- **Nadie se desactiva a sí mismo.**
- Desactivar revoca la **membresía** en esa empresa, no la cuenta.

---

## 4. Roles y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Listar roles | `GET /api/v1/roles` | `access.roles.search` |
| Ver el catálogo de permisos | `GET /api/v1/permissions` | `access.roles.search` |
| Crear | `POST /api/v1/roles` | `access.roles.create` |
| Cambiar nombre y permisos | `PUT /api/v1/roles/:roleId` | `access.roles.update` |
| Asignar a una persona | `POST /api/v1/roles/assignments` | `access.roles.assign` |
| Retirar de una persona | `DELETE /api/v1/roles/assignments` | `access.roles.assign` |

**Reglas**

- Nombre de rol único por empresa.
- Solo se conceden permisos **que existen en el catálogo**.
- Editar un rol reemplaza el **conjunto entero** de permisos (la pantalla manda las casillas
  marcadas).
- El cambio tiene **efecto inmediato**: con el mismo token, la persona pierde el acceso en su
  siguiente petición.

**Catálogo de permisos** (75): 8 de acceso, 20 de catálogo, 7 de inventario, 15 de compras, 18 de ventas y 7 de cuentas por cobrar. Se listan en cada
documento de módulo.

| Código | Qué permite |
|---|---|
| `access.users.search` | Listar los usuarios de la empresa |
| `access.users.create` | Dar de alta a una persona |
| `access.users.update` | Editar el nombre y los roles de una persona |
| `access.users.deactivate` | Desactivar y reactivar a una persona en la empresa |
| `access.roles.search` | Consultar los roles y sus permisos |
| `access.roles.create` | Crear roles |
| `access.roles.update` | Cambiar el nombre y los permisos de un rol |
| `access.roles.assign` | Asignar y retirar roles a un miembro |

---

## 5. Perfil propio

| Acción | Ruta | Declaración |
|---|---|---|
| Cambiar el nombre | `PUT /api/v1/auth/profile` | Autenticado |
| Cambiar la contraseña | `PUT /api/v1/auth/password` | Autenticado |
| Cambiar el correo | `PUT /api/v1/auth/email` | Autenticado |

- Contraseña y correo **exigen la contraseña actual** (`WrongCurrentPasswordError`, 400), para que
  nadie los cambie desde una sesión abierta ajena.
- Un correo que usa otra cuenta: `EmailAlreadyInUseError` (409).

---

## 6. Pantallas

| Ruta | Qué muestra |
|---|---|
| `/login` | Entrar |
| `/` | Panel: empresa activa, cuenta, empresas y permisos |
| `/perfil` | Nombre, correo y contraseña propios |
| `/administracion/usuarios` | Personas con menú Opciones: editar, desactivar |
| `/administracion/roles` | Roles con casillas agrupadas por módulo |
| `/estado` | Público: estado del sistema, útil justo cuando la base está caída |

La **barra lateral** es solo para módulos del negocio. Perfil y Administración viven en el
**menú del nombre**, al pie; Administración solo aparece a quien puede usarla. El selector de
empresa aparece solo a quien tiene más de una.

---

## 7. Pruebas que lo protegen

| Prueba | Qué garantiza |
|---|---|
| `route-declaration.spec.ts` | Toda ruta de toda la API declara quién la alcanza, y decoradores y catálogo cuadran en ambas direcciones |
| `access-repositories.contract.ts` | Los dobles en memoria y PostgreSQL se comportan igual |
| `tests/api/auth.api.spec.ts` | Login, tiempos iguales, bloqueo tras 5 fallos |
| `tests/api/roles.api.spec.ts` | Quitar un permiso corta el acceso con el mismo token |
| `tests/isolation/*` | Cada ruta con identificador, atacada desde Acme contra Globex: 404 y Globex idéntica |
| `tests/resilience/*` | Apagar PostgreSQL: el sistema lo detecta y se recupera |
