# Revisión acotada: Reportes y Acceso

**Fecha:** 19-sep-2026 · **Estado:** 🔶 auditoría parcial, **no revisión completa**
([README](../README.md))

---

## Qué alcance tuvo esto, y qué no

Los cinco módulos anteriores —Catálogo, Inventario, Compras, Ventas y Cuentas por cobrar— tuvieron
la revisión completa del método: mapa del código, lectura del sistema de referencia, matriz
comparativa, hallazgos reproducidos uno a uno y revisión adversarial de lo construido.

**Reportes y Acceso no.** Lo que recibieron fue una **auditoría dirigida** a dos preguntas
concretas, las que esta tanda había demostrado que rinden:

1. ¿Alguna ruta responde distinto que sus gemelas a la misma entrada?
2. ¿Alguna cifra se calcula en más de un sitio, y dicen lo mismo?

Se dice aquí porque **dar un módulo por revisado sin haberlo revisado es peor que dejarlo en
blanco**: la próxima persona confiaría en un ✅ que nadie se ganó.

## Lo que sí se comprobó, y su resultado

### El barrido de identificadores inválidos (encontró dos defectos)

Catorce rutas del sistema aceptan un identificador. Con la misma entrada inválida, tres devolvían
un error interno; **una de ellas era de Reportes**:

```
500  /reports/inventory-valuation?warehouseId=undefined
```

Construido y con prueba, junto con los otros dos, en
[cuentas-por-cobrar.md § C1](../cuentas-por-cobrar/cuentas-por-cobrar.md).

### Las cifras que aparecen en más de un sitio (todas coinciden)

Es el patrón que en Ventas destapó el defecto grave del reservado, así que se buscó a propósito:

| Cifra | Dónde se calcula | ¿Coinciden? |
|---|---|---|
| Valor del inventario | Tablero · Informe de valuación | Sí, 304 en los dos |
| Saldo por cobrar | Tablero · Cuentas por cobrar · Informe de antigüedad | Sí, 39,60 en los tres |
| Antigüedad por tramos | Cuentas por cobrar · Reportes · Estado de cuenta | Sí, **incluso con una factura de 126 días de mora**, que es el caso que los habría separado |
| Vencido | Tablero · Cuentas por cobrar | Sí |

**No se dio por bueno porque coincidieran con los datos de la demostración.** Para la antigüedad se
montó el caso duro y los tres siguieron coincidiendo.

### El documento de la demostración que no se podía anular (defecto encontrado)

Se comprobó que un documento anulado desaparece de las cifras del tablero. El cobro sí:
anularlo baja «cobrado este mes» de 30 a 0 y sube el saldo por cobrar de 39,60 a 69,60.

Al intentar lo mismo con la factura, **apareció otra cosa**:

```
PUT /sales/invoices/{FAC000001}/cancel  -> 400 EmptyStringValueError
     registro: "SalesOrderLineId cannot be empty"
```

**Y sólo le pasa a la factura de la demostración.** Una creada por la API —pedido, despacho,
factura— se anula sin problema (`200`). La diferencia está en la base:

```sql
select code, order_line_id is null from invoice_lines … where code = 'FAC000001';
FAC000001 | t      <-- sin la línea de pedido que factura
```

La semilla escribe las líneas de factura **con Prisma directo**, saltándose el dominio, y no
guardaba `order_line_id`. Sin él, anular no tiene a dónde devolver lo facturado.

**Es exactamente lo que el método avisa**: *los datos de ejemplo suelen documentar el defecto*.
Aquí documentaban un estado que el sistema **no puede producir por sí mismo** — y cualquiera que
abriera la demostración e intentara anular esa factura se habría topado con un error que no
explica nada.

**Corregido en la semilla**, en las dos empresas.

### La empresa que podía quedarse sin nadie que la administre (defecto grave)

El sistema **ya tenía** la regla, y su comentario declara exactamente el riesgo:

> ```
> // Si el unico administrador pudiera desactivarse, la empresa se quedaria sin nadie
> // capaz de devolverle el acceso.
> export class CannotDeactivateSelfError extends ConflictError {
> ```

**Pero sólo cubría un camino de dos.** Reproducido contra la API:

```
PUT /users/{ana}/status {active:false}       -> 409  CannotDeactivateSelfError   (bien)
PUT /users/{ana} {roleIds: []}               -> 200  se quita su propio rol
GET /users                                   -> 403  PermissionDeniedError
GET /roles                                   -> 403
PUT /users/{ana} {roleIds:[administrador]}   -> 403  no puede devolvérselo
```

Ana se encerró fuera **en la misma sesión**, porque los permisos se releen de la base en cada
petición. Si hubiera sido la única administradora, la empresa quedaría **sin nadie capaz de
devolver el acceso** — que es, palabra por palabra, lo que el comentario dice que la regla existe
para impedir.

**Es el mismo patrón que esta sesión encontró cuatro veces**: el código afirma una intención que no
cumple. Aquí la afirmación estaba escrita en un comentario, y bastó leerla para saber qué probar.

**Construido:** `CannotDropOwnAdminRoleError`, la otra mitad de la regla. El caso de uso no recibía
siquiera quién hacía el cambio —por eso no podía compararlo—, así que ahora recibe `actorId`, como
ya hacía el de desactivación.

**Y no estorba lo que sí debe poder hacerse**, comprobado contra la API: añadirse un rol sin soltar
la administración pasa (`200`), y quitarle los roles **a otra persona** también (`200`). Lo único
que se impide es quedarse uno mismo sin poder administrar.

### Los listados de Acceso

```
/users        3 filas      /roles   2 filas      /permissions   89 filas
```

Ninguno pagina. **Se deja así, con el porqué:** los permisos son un catálogo cerrado que el
sistema define —89 y sólo cambian al construir una función nueva—, y los roles son pocos por
diseño. El único que crece con el uso es el de usuarios, y crece despacio. Paginar los tres ahora
sería aplicar una receta sin la necesidad que la justifica, que es justo lo que este proyecto
decidió no hacer con los campos de la bodega y con el tipo «no inventariado».

## Lo que se comprobó después, y salió bien

- **El tablero excluye los anulados y los borradores en seis de sus siete cifras**, con filtro
  explícito (`status='issued'` o `'confirmed'`). La séptima, `inventoryValue`, **no puede
  excluirlos porque lee un saldo, no documentos**: depende de que el inventario revierta la
  existencia al anular, que es justo lo que la revisión de Inventario comprobó.
- **«Este mes» usa la zona horaria de la empresa, no la del servidor.** Sale del puerto
  `BusinessCalendar` → `CompanyCalendar` → `Intl.DateTimeFormat('en-CA', { timeZone })`, y las
  comparaciones son contra columnas de fecha sin hora, así que no hay desfase en la frontera del
  día 1.
- **Quitar un permiso a un rol surte efecto en la siguiente petición, sin volver a entrar.** El
  token lleva los permisos, pero **el guardián no los mira**: sólo usa `userId` y `tenantId` y
  recarga los roles de la base. Los permisos del token existen para que la interfaz pinte botones.
- **Desactivar a alguien corta su sesión abierta al instante**, por la misma razón.
- **Las cuatro exportaciones llaman al mismo caso de uso que la pantalla** con el mismo objeto de
  petición: no repiten la consulta con otros filtros.

## Lo que NO se miró, y habría que mirar

- **Las exportaciones redondean distinto que la pantalla**: la pantalla usa de 2 a 4 decimales y la
  exportación fija 2, y **ninguno de los dos usa los decimales que la empresa configura**. Es la
  misma familia del defecto que la revisión de Existencias encontró en el valor del inventario, y
  merece su propia comprobación.
- **La sesión**: dura una hora y **no se renueva ni se puede revocar en el servidor** — cerrar
  sesión sólo borra la cookie, y el token sigue siendo válido hasta caducar. No existe «cerrar en
  todos los dispositivos». Tampoco se miró si eso importa para este proyecto.
- **El bloqueo por intentos fallidos se guarda en memoria del proceso**, así que con varias
  instancias el límite se multiplica.
- **Un rol puede quedarse sin ningún permiso**, y un rol no se puede borrar ni desactivar.
- **Ventas por cliente**: sin revisar.
- **El sistema de referencia**: no se leyó para ninguno de los dos módulos.
