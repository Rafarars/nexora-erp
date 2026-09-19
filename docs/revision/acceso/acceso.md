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

## Los diez hallazgos

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
| **A10** | Cambiar la contraseña no cerraba las sesiones abiertas | **Alta** | Construido |
| **A12** | El rol que lo concede todo sólo estaba protegido **en la pantalla** | **Alta** | Construido |

**Ocho construidos y uno anotado**: A9 sigue abierto a propósito, y abajo está el porqué.

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

**Decisión de Rafael:** la opción amplia — *nadie se concede lo que no tiene*. Al cambiar sus
**propios** roles, los permisos resultantes tienen que caber en los actuales. Cierra también la
escalada indirecta, que la opción estrecha dejaba abierta: asignarse un rol «Contabilidad» con
permisos que no se tenían seguía siendo un ascenso, aunque no llegara hasta el final.

Quien ya administra no se ve afectado, porque no hay a qué ascenderlo. Y repartir roles a **otra**
persona sigue siendo lo normal: lo que se protege es ascenderse uno mismo.

---

## A10 — La contraseña que no echaba a nadie

Cambiar la contraseña no tocaba ninguna sesión. El token firmado seguía valiendo hasta una hora, así
que **quien se hubiera llevado una sesión seguía dentro** después de que su dueño reaccionara.
Tampoco existía «cerrar sesión en todos los dispositivos»: cerrar sesión sólo borraba la cookie del
navegador.

**Decisión de Rafael:** una fecha de corte por persona. Una columna, `sessions_valid_from`; el
guardián rechaza los tokens firmados antes de ella; y cambiar la contraseña la mueve.

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

## A9 y A8 — El bloqueo por intentos

Comprobado, en los dos sentidos:

```
5 intentos fallidos ajenos contra contador@externo.com
luego, con la contraseña BUENA              -> 429 TooManyLoginAttemptsError
docker compose restart api
luego, con la contraseña BUENA              -> entra: el bloqueo se esfumó
```

Contar **sólo por correo** permitía dejar fuera a cualquiera sabiendo su dirección, repitiéndolo
cada quince minutos. Y el mapa **sólo se limpiaba al acertar**, así que cada correo inventado dejaba
una entrada que no se iba nunca.

**Decisión de Rafael:** contar también por dirección de red —veinte fallos, más alto que el del
correo porque una oficina entera sale por la misma— y barrer las entradas caducadas.

Un detalle deliberado: **acertar limpia el contador del correo, pero no el de la dirección.** Si lo
limpiara, a quien lleva rato probando cuentas ajenas desde el mismo sitio le bastaría acertar una
para empezar de cero.

**Y aquí la corrección costó dos intentos y una lección.** El comentario que había en el código
**ya advertía** exactamente lo que iba a pasar:

> «Cuenta intentos fallidos por correo, no peticiones por IP: la suite de pruebas entra decenas de
> veces por minuto desde la misma direccion y no debe bloquearse sola.»

El primer intento contó **fallos** por dirección: veinte pruebas en rojo. El segundo contó **cuentas
distintas**, y pareció bastar… hasta que la suite completa acabó con **314 pruebas en 401**, todas
por el mismo `429`. La razón es de fondo: una suite de pruebas **es** un barrido de cuentas desde
una sola dirección, que es justo lo que el límite busca.

La regla que sí distingue las dos cosas —decisión de Rafael— es mirar **cuántos correos que no
existen** se prueban desde una dirección. Equivocarse de contraseña en una cuenta real es un
despiste, y castigarlo deja fuera a una oficina entera detrás de una misma salida a internet.
Probar correos al azar es otra cosa: es **adivinar a quién hay**, y eso no lo hace nadie por
error.

**Y eso deja A9 abierto, hay que decirlo.** Contar sólo las cuentas inexistentes frena la
enumeración, pero **no impide dejar fuera a alguien a propósito**: cinco intentos contra un correo
real siguen bloqueando ese correo quince minutos, y ese fallo no cuenta para la dirección. Es el
precio de no castigar a la oficina entera, y está escrito en [`FUTURE.md`](../../FUTURE.md) con lo
que haría falta para cerrarlo de verdad.

Un detalle que casi se me cuela, y que es justo el patrón que esta revisión persigue: al releer mi
propio diff encontré **un comentario mío que afirmaba lo que el código ya no hacía** —decía que el
conteo por dirección evitaba que «nadie pueda dejar fuera a un compañero sabiendo sólo su correo»,
y tras la última corrección eso dejó de ser cierto—. Corregido.

La lección, que vale más que el arreglo: **un comentario que explica un porqué es una restricción de
diseño, no una nota al margen.** Costó dos vueltas no haberlo leído como tal.

Lo que **no** cambia: el estado sigue en la memoria del proceso. Con una sola instancia basta; con
varias haría falta Redis o una tabla. Queda escrito en [`FUTURE.md`](../../FUTURE.md).

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
