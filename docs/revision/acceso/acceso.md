# Revisión del módulo de Acceso

**19 de septiembre de 2026.** Tres submódulos en una pasada, en modo lote: **la sesión**, **los
roles y permisos** y **el perfil propio**. Es la sexta revisión con la skill `module-review`, y
cierra el penúltimo módulo del sistema.

Antes de esto, Acceso sólo tenía una **auditoría acotada**
([informe](../reportes/reportes-y-acceso.md)), que ya había encontrado un defecto grave. Esta es la
revisión completa.

---

## El hallazgo que resume el módulo

Ayer se construyó una guarda para que nadie pudiera quitarse a sí mismo la administración y dejar a
su empresa sin gobierno. **La guarda funcionaba. Y la puerta de al lado seguía abierta.**

El mismo acto, por dos rutas distintas:

```
PUT    /api/v1/users/{ana}            roleIds: []        -> 409  CannotDropOwnAdminRoleError
DELETE /api/v1/roles/assignments      {ana, rol admin}   -> 200  y Ana se quedó con 0 permisos
GET    /api/v1/users                  con el token de Ana -> 403
```

`RoleRevoker` no recibía siquiera **quién** estaba actuando: el controlador le pasaba
`{ ...body, tenantId }` y nada más. No es que la comprobación estuviera mal hecha; es que no había
dónde hacerla.

Es exactamente lo que la propia skill advierte, y por eso está escrito en ella: **abrir un camino
alternativo a un flujo existente obliga a repasar todas las reglas que el camino viejo daba por
hechas.** La suite seguía verde porque el camino nuevo se las saltaba.

---

## Los doce hallazgos

Todos **reproducidos contra la API local** antes de tocar una línea de código.

| | Qué | Gravedad | Estado |
|---|---|---|---|
| **A1** | La vida de la sesión se decidía en dos sitios y sólo uno mandaba | Media | Construido |
| **A2** | La revocación de rol no sabía quién actuaba: se saltaba la guarda entera | **Alta** | Construido |
| **A3** | Una empresa podía quedarse **sin ningún administrador** | **Alta** | Construido |
| **A4** | Escalada de privilegios: uno se ascendía a sí mismo | **Alta** | Construido |
| **A6** | Un rol podía nacer sin ningún permiso | Media | Construido |
| **A7** | Los DTO de Acceso aceptaban campos que ignoraban | Baja | Construido |
| **A8** | El bloqueo por intentos se perdía al reiniciar, y no se purgaba nunca | Media | Construido |
| **A9** | Se puede dejar fuera a alguien a propósito | Media | **Anotado, no construido** |
| **A14** | El conteo de administradores no filtraba la empresa **del rol** | Media | Construido |
| **A10** | Cambiar la contraseña no cerraba las sesiones abiertas | **Alta** | Construido |
| **A12** | El rol que lo concede todo sólo estaba protegido **en la pantalla** | **Alta** | Construido |
| **A13** | Dos peticiones a la vez se saltaban la guarda del último administrador | **Alta** | Construido |

**Once construidos y uno anotado**: A9 sigue abierto a propósito, y abajo está el porqué.

Y uno descartado: **A11, que los listados de Acceso no paginan.** Ya estaba decidido y razonado en
la auditoría anterior —los permisos son un catálogo cerrado de 89, los roles son pocos por diseño y
las personas crecen despacio—, así que no se toca.

---

## A3 — Una empresa sin nadie que la administre

Las dos guardas que existían miraban **sólo el caso propio** (`actorId === userId`). Nadie
comprobaba si quien perdía la administración era **el último que quedaba**.

Reproducido con una cuenta que nunca fue administradora: Sara, con un rol «Supervisor» de cuatro
permisos y `grantsAll: false`.

```
Sara quita la administración a Ana          -> 200
Sara quita la administración a Superusuario -> 200
>>> ADMINISTRADORES QUE QUEDAN EN ACME: 0
```

Y **no se podía arreglar desde dentro**: ninguna pantalla ni ninguna ruta crea un rol con
`grantsAll`, porque el cuerpo de la petición ni siquiera acepta ese campo. La empresa quedaba
gobernada por nadie, para siempre.

**Lo construido.** Un puerto, `TenantAdministration`, con una sola pregunta —cuántas personas
activas administran la empresa sin contar a la indicada— y una política de dominio,
`AdministrationPolicy`, que reúne la regla **en un solo sitio**, por la misma razón que
`SignInPolicy`: tres caminos distintos quitaban la administración y cada uno comprobaba lo suyo o
no comprobaba nada.

La política recibe cómo queda la persona **después** del cambio, no antes: quien conserva otro rol
que lo concede todo no deja hueco, y bloquearlo sería decir que no por un peligro que no existe.

Los tres caminos quedan cerrados, comprobado contra la API:

```
Sara quita la administración a la última, por DELETE -> 409 LastAdministratorError
Sara quita la administración a la última, por PUT    -> 409 LastAdministratorError
Sara desactiva a la última                           -> 409 LastAdministratorError
>>> ADMINISTRADORES QUE QUEDAN EN ACME: 1
```

---

## A4 — Ascenderse a uno mismo

El permiso de repartir roles **valía por todos los demás**:

```
Sara (grantsAll: false, 4 permisos)
POST /api/v1/roles/assignments  {ella misma, rol Administrador}  -> 200
GET  /api/v1/auth/me                                             -> grantsAll: true
```

Nadie comprobaba que no se concediera más de lo que se tenía.

**Decisión de Rafael:** la opción amplia — *nadie se concede lo que no tiene*.

**Y la primera implementación se quedó corta, hasta el punto de ser decorativa.** La escribí
mirando sólo el caso propio (`actorId === userId`) y en sólo dos de los cinco caminos que reparten
acceso. La revisión adversarial encontró las dos puertas que quedaban, y las dos se reprodujeron
contra la API:

```
A) Olga edita SU PROPIO rol y marca los 89 permisos   -> 200, de 3 permisos a 89
B) Bruno crea una cuenta CON el rol que lo concede todo -> 201, y entra: grantsAll: true
```

Ninguna de las dos se toca a sí misma en el sentido que la guarda miraba: una amplía **el rol que
lleva**, la otra asciende **a una cuenta títere**. La regla real no era «no te asciendas a ti
mismo», sino **«nadie concede lo que no tiene, ni a sí mismo ni a otro»**, y tiene que vivir en los
cinco caminos: crear un rol, editarlo, asignarlo, retirarlo al editar a una persona y dar de alta a
una persona nueva.

Tras corregirlo, las mismas dos reproducciones:

```
A) editar su propio rol con los 89 permisos -> 409 CannotGrantSelfMoreAccessError
B) crear la cuenta con ese rol              -> 409 CannotGrantSelfMoreAccessError
```

Quien ya administra no se ve afectado, porque no hay nada fuera de su alcance. Y **quitar** un rol
no pide alcance: sólo concederlo lo pide, así que un supervisor sigue pudiendo retirar roles —y ahí
es donde le sale al paso la guarda del último administrador—.

---

## A10 — La contraseña que no echaba a nadie

Cambiar la contraseña no tocaba ninguna sesión. El token firmado seguía valiendo hasta una hora, así
que **quien se hubiera llevado una sesión seguía dentro** después de que su dueño reaccionara.
Tampoco existía «cerrar sesión en todos los dispositivos»: cerrar sesión sólo borraba la cookie del
navegador.

**Decisión de Rafael:** una fecha de corte por persona. Una columna, `sessions_valid_from`; el
guardián rechaza los tokens firmados antes de ella; y cambiar la contraseña la mueve.

**Con un matiz que hay que decir:** la fecha de corte *permite* «cerrar sesión en todos los
dispositivos», pero **no existe ninguna pantalla ni ruta que lo ofrezca**. Hoy sólo la mueve el
cambio de contraseña. El método que lo haría por su cuenta se escribió, no lo llamaba nadie, y se
retiró: un método muerto con un comentario que promete una puerta inexistente es peor que no
tenerlo.

Dos detalles que decidieron el diseño:

- **La fecha se mueve en la entidad, dentro de `changePassword`**, no en el caso de uso. Así ninguna
  forma futura de cambiar la contraseña puede olvidarse de hacerlo.
- **La marca de emisión va en milisegundos, en un campo propio del token.** El `iat` estándar de un
  JWT viene en segundos, y con esa precisión dos sesiones del mismo segundo son indistinguibles: la
  primera versión toleraba un segundo entero, y la prueba de extremo a extremo lo destapó enseguida
  —la sesión del «otro dispositivo» sobrevivía al cambio porque todo ocurría dentro del mismo
  segundo—. Con milisegundos la comparación es exacta y no hace falta ninguna tolerancia.

Y para que quien cambia su contraseña no se eche a sí mismo, `PUT /auth/password` **devuelve una
sesión nueva**, que la interfaz guarda. Caen los demás dispositivos, no el suyo.

Se reemite con los permisos de verdad, reconstruyendo la sesión como hacen el inicio de sesión y el
cambio de empresa. La alternativa —firmar un token con la lista de permisos vacía— habría dejado
**una mentira dentro del token**, y esta revisión entera trata justo de eso.

---

## A12 — La regla que vivía sólo en la pantalla

`roles-board.tsx` esconde el botón «Editar» cuando el rol concede todos los permisos. La API no
comprobaba nada:

```
PUT /api/v1/roles/{administrador}  {name: 'Consulta basica', permissions: []}  -> 200
```

El rol pasaba a llamarse **«Consulta basica» y seguía concediendo la empresa entera**. Quien lo
asignara creyendo que daba lectura, entregaba todo. Y la pantalla lo respaldaba: como el rol no
enumera permisos, aparecía con ninguno marcado.

Lo llamativo es la dirección: la revisión suele encontrar reglas del dominio que la interfaz no
respeta. Aquí era al revés — **la interfaz protegía algo que el servidor no**.

---

## A13 — La guarda que dos peticiones a la vez se saltaban

Este apareció en la **última pasada**, revisando lo ya construido, y es el mejor argumento a favor de
que esa pasada exista: la guarda del último administrador comprobaba y escribía en momentos
distintos, sin nada que los uniera.

Dos peticiones simultáneas, cada una quitando la administración a una de las dos últimas
administradoras: **ambas cuentan antes de que la otra escriba, ambas ven que queda alguien, y ambas
se dan por buenas.**

```
intento 1: 200/409 -> administradores que quedan: 1
intento 2: 200/200 -> administradores que quedan: 0  <<< CARRERA
intento 3: 200/200 -> administradores que quedan: 0  <<< CARRERA
intento 4: 200/200 -> administradores que quedan: 0  <<< CARRERA
intento 5: 200/200 -> administradores que quedan: 0  <<< CARRERA
```

**Decisión de Rafael:** un cerrojo por empresa que envuelve comprobar y escribir, que es el patrón
que Ventas e Inventario ya usan para reservar existencia. Un `pg_advisory_xact_lock` por empresa: no
bloquea ninguna tabla, sólo hace que dos peticiones **de la misma empresa** se turnen. Las mismas
cinco vueltas, ahora: `200/409` las cinco veces, y siempre queda alguien administrando.

**Y la prueba costó tres intentos, cada uno enseñando algo.**

1. La primera versión, de extremo a extremo, **pasaba sin el cerrojo**: el cliente HTTP de Playwright
   reutiliza la conexión y encolaba las dos peticiones, así que nunca llegaban a solaparse.
2. Reescrita con `fetch`, seguía pasando: una de las dos peticiones era la administradora
   **quitándoselo a sí misma**, y ese 409 venía de otra guarda, no del cerrojo. La prueba medía otra
   cosa.
3. La tercera funcionaba, pero dependía del reloj: una prueba de carrera que a veces reproduce y a
   veces no es una prueba intermitente, y este proyecto no las quiere.

La que quedó es **determinista y vive en el contrato del puerto**: exige que dos trabajos de la misma
empresa **se turnen**, y que dos empresas distintas **no se estorben**. Se comprobó quitando el
cerrojo: contra PostgreSQL falla con `expected 'second in' to be 'first out'`, que es exactamente el
entrelazado. Y **el doble en memoria también tiene que turnarse**, porque si sólo lo hiciera
PostgreSQL, el contrato pasaría verde contra el doble escondiendo el defecto — el falso verde que
esta misma sesión ya encontró una vez.

---

## A9 y A8 — El bloqueo por intentos, y dos vueltas en falso

Comprobado, en los dos sentidos:

```
5 intentos fallidos ajenos contra contador@externo.com
luego, con la contraseña BUENA              -> 429 TooManyLoginAttemptsError
docker compose restart api
luego, con la contraseña BUENA              -> entra: el bloqueo se esfumó
```

Contar **sólo por correo** permite dejar fuera a cualquiera sabiendo su dirección, y el mapa
**sólo se limpiaba al acertar**, así que cada correo inventado dejaba una entrada que no se iba
nunca.

**Lo construido:** la purga de entradas caducadas, y que **la ventana arranque de nuevo al
bloquear** —sin eso, un fallo posterior podía caer fuera de la ventana vieja, reiniciar el contador
y levantar el bloqueo antes de tiempo—.

**Lo que se intentó y se retiró, que es lo que enseña.** La decisión inicial fue contar también por
dirección de red. Costó tres vueltas y acabó fuera:

1. Contando **fallos** por dirección: veinte pruebas en rojo. El comentario del código **ya lo
   advertía** palabra por palabra —«la suite de pruebas entra decenas de veces por minuto desde la
   misma direccion y no debe bloquearse sola»—, y no le hice caso.
2. Contando **cuentas distintas**: la suite completa acabó con **314 pruebas en 401**. Una suite de
   pruebas **es** un barrido de cuentas desde una sola dirección, que es justo lo que el límite
   busca.
3. Contando sólo las **cuentas que no existen**: la suite pasó… y el mecanismo se convirtió en **un
   oráculo de enumeración**. Reproducido:

```
ana@acme.com    -> EXISTE      (no contó: la dirección sigue en 19)
nadie@acme.com  -> NO EXISTE   (contó 20: la dirección se bloqueó)
```

Veintiuna peticiones bastaban para saber si un correo está registrado — exactamente lo que el
tiempo constante del login (29 ms contra 28 ms) protege. **El mecanismo puesto para frenar la
enumeración la volvía trivial.** Y hay un segundo problema: la API no configura `trust proxy`, así
que detrás de un balanceador `@Ip()` devuelve la misma dirección para todo el mundo y veinte
peticiones anónimas habrían dejado fuera a la empresa entera.

**Decisión de Rafael, con ese dato encima de la mesa:** retirar el conteo por dirección. Queda el
límite por correo con su purga, desaparecen el oráculo y el riesgo del proxy, y **A9 sigue abierto a
propósito**, escrito en [`FUTURE.md`](../../FUTURE.md) con el retardo creciente como salida real.

La lección, que vale más que el código: **un comentario que explica un porqué es una restricción de
diseño, no una nota al margen** — y cuando una defensa nueva trata distinto dos casos, esa
diferencia es observable, y lo observable es un oráculo.

---

## Dos olvidos que destapó una prueba

Al traducir los errores nuevos apareció que **`CannotDropOwnAdminRoleError`, construido ayer, no
tenía traducción**: caía en el genérico de su categoría, «Ese dato ya existe», que dice justo lo
contrario de lo que pasa. Y **tampoco estaba declarado** en la prueba que asigna cada error a su
categoría.

Dos olvidos del mismo error, en dos sitios distintos, sin que nada se quejara. Así que en vez de
añadirlo a mano y seguir, se cerró la puerta:

- Una prueba compara la lista de categorías **con el directorio de errores**. Al escribirla apareció
  que **otros tres errores llevaban tiempo fuera de la lista**: `UnknownPermissionError`,
  `UndeclaredEndpointError` y `ContradictoryDeclarationError`.
- Otra, en la interfaz, comprueba que **cada error que la API puede mandar tiene su texto en
  español**. Los que se conforman con el mensaje de su categoría están escritos uno a uno: estar en
  esa lista es una decisión, no un olvido.

---

## A14 — El doble contaba mejor que la base

Lo encontró la revisión adversarial leyendo el SQL. `PrismaTenantAdministration` filtraba la empresa
**de la membresía**, pero no la **del rol**:

```sql
roles: { some: { role: { grantsAll: true } } }     -- sin tenantId del rol
```

`membership_roles` no impide unir una membresía de una empresa con un rol de otra, así que una fila
así habría contado como administradora de Acme a quien lleva un rol de Globex. Y **contar de más es
la dirección mala**: la política habría dejado quitarle el rol al último administrador de verdad
creyendo que quedaba otro.

Hoy ninguna ruta crea esa fila —`RoleFinder` filtra por empresa—, pero el contrato existe justo para
que el adaptador no dependa de eso. Lo llamativo es que el caso del contrato que parecía cubrirlo
**no lo cubría**: ponía la *membresía* en la otra empresa, que es lo que filtra el otro `where`.
Ahora hay tres casos nuevos, y quitando el filtro el contrato falla contra PostgreSQL y pasa contra
el doble — el falso verde otra vez, por tercera vez en esta sesión.

---

## Lo que se comprobó y estaba bien

Vale la pena escribirlo para no volver a mirarlo, y porque el acierto enseña tanto como el fallo:

- **El tiempo de respuesta del inicio de sesión no delata qué correos existen.** El código lo
  afirmaba —«el hasher usa un hash de relleno y tarda lo mismo»— y esta vez **la afirmación era
  cierta**: mediana de 29 ms con un correo registrado contra 28 ms con uno inventado.
- **El aislamiento entre empresas resiste.** Los cinco caminos que tocan a una persona de otra
  empresa responden 404, sin confirmar siquiera que exista.
- **`grantsAll` no se puede quitar editando un rol**: es de sólo lectura en la entidad y no hay
  método que lo cambie.
- **El guardián recarga los roles de la base en cada petición** y la interfaz pide `/auth/me` en
  cada pantalla, así que quitar un permiso surte efecto de inmediato, en el servidor y en lo que se
  ve.
- **Ninguna ruta llega sin declarar** qué pide: lo vigila una prueba que las recorre todas.
- **El cuerpo de las peticiones nunca acepta `tenantId`**: sale siempre de la sesión firmada.

---

## Cómo lo resuelve el sistema de referencia, y qué dice el sector

Las dos lecturas llegaron tarde —la revisión ya estaba construida—, así que **no guiaron ninguna
decisión**. Sirven para contrastar lo que quedó, y en dos puntos señalan trabajo pendiente.

### El sistema de referencia: `verlumyx/erp`

| | Allí | Aquí |
|---|---|---|
| **No quedarse sin administrador** | **No existe ninguna guarda.** Nada impide desactivar o degradar a todos los usuarios con rol de administrador | Guarda en los tres caminos, con cerrojo por empresa |
| **Proteger el rol de administrador** | Por **comparación de nombre exacto**: `$this->name === 'Administrador'` | Por un booleano `grantsAll` de sólo lectura en la entidad |
| **Rol sin permisos** | Permitido: `'permissions' => ['nullable', 'array']` | Rechazado |
| **Borrar un rol** | No existe la ruta: sólo activar y desactivar | No existe la ruta |
| **Bloqueo por intentos** | Web: 5/min por **correo + IP**. API móvil: 10/min **sólo por IP** | 5 por correo, ventana de 15 min |
| **Revocar sesión** | Sí: el cierre de sesión borra el token de Sanctum **de ese dispositivo** | Fecha de corte por persona: caen todas las anteriores |
| **Sesiones concurrentes** | Límite de **2 dispositivos**: el tercer inicio se rechaza | Sin límite |
| **Contraseñas** | En producción: 12 caracteres, mayúsculas, números, símbolos y contraste contra filtradas… **salvo en el alta manual, que exige 8** | 8 caracteres, sin más reglas |
| **Auditoría del acceso** | No la hay, **aunque el resto del sistema sí usa `created_by`** | No la hay |

Lo que más enseña de esta comparación: **su protección del rol de administrador depende de una
cadena de texto**. Renombrarlo, o crear otro rol que se llame distinto, la desactiva. La nuestra
descansa en un booleano que la entidad no deja cambiar — y aun así esta revisión encontró que la
regla de *no editarlo* vivía sólo en la pantalla. La misma idea, dos formas de fallar.

Y su inconsistencia de contraseñas —fuerte en el registro, floja en el alta manual— es exactamente
la familia de defecto que esta sesión persiguió: **la misma regla escrita dos veces, y sólo una se
actualiza**.

### El consenso del sector

Con cita verificable; lo que no se pudo verificar queda dicho como tal.

- **Invalidar la sesión al cambiar la contraseña**: OWASP lo pide — «the session ID must be renewed
  or regenerated … after any privilege level change». Es justo lo que se construyó.
- **Contar por cuenta, no por IP**: OWASP lo dice textualmente — «the counter of failed logins
  should be associated with the account itself, rather than the source IP address». Coincide con
  donde acabó la decisión, después de tres vueltas.
- **Mensaje genérico**: OWASP pide la misma respuesta exista o no la cuenta. Cumplido, y también en
  el tiempo.
- **El último administrador**: GitHub, Google Workspace y Atlassian lo protegen, cada uno a su
  manera —GitHub no te deja cambiar tu propio rol, Atlassian exige pasar por su soporte si te
  quedas sin ninguno—. **Odoo y ERPNext no tienen nada documentado**, igual que la referencia.
- **Contraseñas**: aquí sí hay una brecha. NIST SP 800-63B Rev. 4 (agosto de 2025) pide **15
  caracteres** como mínimo para contraseña única, **prohíbe** exigir mezclas de tipos de carácter y
  **prohíbe** la caducidad periódica, y exige contrastar contra **listas de contraseñas filtradas**.
  El sistema pide 8 y no contrasta nada. Anotado en [`FUTURE.md`](../../FUTURE.md).
- **Auditoría de accesos**: ASVS pide registrar autenticaciones y fallos de autorización. El sistema
  **no registra nada de eso**, y es un requisito habitual de SOC 2 e ISO 27001. También anotado.

---

## Lo que esta revisión NO hizo

Para que quien la lea sepa dónde están los bordes:

- **La referencia y el sector se leyeron DESPUÉS de construir.** Las dos lecturas llegaron tarde,
  así que no guiaron ninguna decisión: todos los hallazgos salieron de leer el código propio y
  reproducirlos contra la API. El contraste está arriba, y deja dos cosas pendientes —las reglas de
  contraseña y la auditoría de accesos—, ambas anotadas.
- **La auditoría de accesos no existe** y no se construyó: el sistema no registra quién entró ni
  quién cambió permisos a quién.
- **La pasada a mano se hizo sobre lo construido hoy**, no sobre todas las pantallas del módulo: se
  comprobó que el rol de administrador aparece sin botón de editar, que el rol vacío se rechaza con
  su mensaje en español, y que quien cambia su contraseña sigue dentro después.
