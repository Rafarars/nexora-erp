# Revisión de Reportes

**Fecha:** 19 de septiembre de 2026 · **Estado:** ✅ cerrado
([checklist](../README.md)) · Módulo revisado en lote, los tres submódulos que faltaban.

Antes de esto, Reportes tenía una [auditoría acotada](reportes-y-acceso.md) —dos preguntas, no una
revisión— que dejó verdes el Tablero y la Antigüedad de saldos. Esta revisión cierra los tres
restantes: **ventas por cliente**, **estado de cuenta** y **valuación del inventario**.

---

## El resumen, en una frase

El módulo calculaba bien y **enseñaba mal**: las cifras que salen de la base de datos eran
correctas y estaban probadas, pero el camino desde el número hasta el papel perdía precisión,
mezclaba notaciones y, en un caso, **mentía sobre el alcance del documento**.

---

## Lo que se encontró

**Doce hallazgos, todos construidos.** Seis salieron de leer y usar el módulo; **seis más los
encontró la revisión adversarial**, cinco sobre código escrito ese mismo día y uno preexistente que
nadie había mirado. Es, otra vez, la etapa que más rinde.

| | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| **R1** | El PDF y el Excel redondean a dos decimales aunque la empresa configure cuatro: **las filas dejan de sumar el total del mismo documento** | Alta | ✅ |
| **R2** | La cabecera del estado de cuenta escribe `1000.00` y su tabla `1.000,00`, en el mismo papel | Media | ✅ |
| **R3** | El PDF de una bodega vacía dice **«Todas las bodegas»** | Alta | ✅ |
| **R4** | Ningún informe paginaba, y el estado de cuenta no tenía techo de ninguna clase | Media | ✅ |
| **R5** | Búsqueda lineal dentro de un recorrido, en dos informes | Baja | ✅ |
| **R6** | Las cuatro descargas de valuación se llamaban igual | Baja | ✅ |
| **R7** | El estado de cuenta paginaba **al revés de lo que rotulaba**: «1–2 de 5» con las filas 4 y 5 | Alta | ✅ |
| **R8** | Con el desplazamiento pasado del total, el paginador **desaparecía**: pantalla vacía y sin vuelta | Media | ✅ |
| **R9** | El doble en memoria no encontraba un identificador en mayúsculas y PostgreSQL sí | Media | ✅ |
| **R10** | **Un cliente llamado «Comercial A/B» tumbaba la exportación a Excel con un error interno** | Alta | ✅ |
| **R11** | El nombre del archivo se comía los acentos: «Depósito» daba `dep-sito` | Baja | ✅ |
| **R12** | La página aceptaba `0x10` como 16, y la misma entrada mala daba dos errores distintos | Baja | ✅ |

### R1 — El documento que no cuadra consigo mismo

`report-values.ts:7` fijaba `amount: [2, 2]`, y `report-renderer.ts:7` fijaba el formato de Excel
`'#,##0.00'`. La pantalla, en cambio, usaba un formateador **del módulo de compras** con un mínimo
de dos decimales y un máximo de cuatro.

Lo importante es lo que **no** estaba mal: el SQL **sí** respetaba los decimales de la empresa —el
parámetro `decimals` viaja en cada consulta de `prisma-reporting-read-model.ts`—. La nota que este
hallazgo tenía escrita desde la auditoría anterior decía que *ninguna* de las dos vías usaba
`amountDecimals`, y era inexacta: el cálculo sí, el formateo no.

Una empresa puede configurar de **0 a 4** decimales (`company-settings.entity.spec.ts:29-31`
rechaza 5 y −1). Con cuatro, así salía el mismo dato por cada camino:

```
valor de la fila: 1,006      total: 2,012
PANTALLA   1,006 + 1,006     total 2,012    ✅ cuadra
PDF        1,01  + 1,01      total 2,01     ❌ lo que se ve suma 2,02
```

**Un informe cuyas filas no suman su propio total no sirve para lo único que sirve un informe.**

*Cómo quedó:* los decimales viajan dentro del `ReportDocument` y los escriben igual la pantalla, el
PDF y el Excel. El formateo se movió al dominio (`domain/document/report-format.ts`) porque la capa
de aplicación no puede importar infraestructura.

### R2 — Dos notaciones en el mismo papel

`report-documents.ts:42` y `:47` usaban `.toFixed(2)`, que escribe con **punto** y sin separar los
miles, mientras la tabla de abajo escribía con **coma** y miles agrupados. El estado de cuenta
salía con la cabecera diciendo `Saldo 1234.50` y la fila Total diciendo `1.234,50`.

### R3 — El papel que niega el inventario de la empresa

El más serio, y el único que se encontró **usando el sistema** en vez de leyéndolo.

`report-exports.ts:46` sacaba el nombre de la bodega de `report.rows[0]`. Una bodega vacía no tiene
primera fila, así que el nombre quedaba nulo y `report-documents.ts:88` caía en el caso por
omisión. Salida real, filtrando por la bodega Norte de la demostración, que existe y está vacía:

```
Valuación del inventario
Acme Industrial, C.A. · RIF J-40000001-2
Todas las bodegas          ← miente
Total                              0,00
```

Quien imprime eso tiene en la mano un documento que afirma que **la empresa entera** no tiene
inventario. Con el arreglo dice «Bodega Norte».

*Cómo quedó:* el puerto dejó de responder «¿existe?» y responde «¿cómo se llama?»
(`warehouseNamed`). El nombre ya no depende de que haya filas. El contrato del puerto exige a
PostgreSQL y al doble en memoria que devuelvan lo mismo, incluido el caso de la bodega ajena.

### R4 — Paginar sin romper los totales

Ningún informe paginaba, y el estado de cuenta era el peor caso: devolvía la historia completa de
un cliente, sin techo de fechas ni de filas.

**La decisión fue de Rafael**: la pantalla pagina, la exportación sale completa. Un PDF paginado a
cincuenta filas deja de servir como documento.

Eso obliga a una regla que puede romperse en silencio: **los totales cubren siempre todas las
filas, nunca la página enviada**. Por eso se pagina en la aplicación, después de sumar, y no en la
consulta. Está escrito en `report-page.ts` y hay una prueba que lo defiende; se comprobó que falla
si los totales se calculan sobre la página.

Verificado contra la empresa de volumen: **50 clientes recorridos de 7 en 7, idéntico al listado
completo, sin repetir ni perder una fila, y el total quieto en 256.550,00 en todas las páginas.**

### R5 y R6

`sales-by-customer-report.ts:31` buscaba cada cliente con un `find` dentro de un `map`, y
`receivables-aging-report.ts:41` filtraba todas las facturas por cada cliente. Con cincuenta
clientes y cinco mil facturas eso son doscientas cincuenta mil comparaciones por informe. La
antigüedad ahora agrupa una vez.

Las cuatro descargas de valuación se llamaban `valuacion-de-inventario`, sin bodega ni fecha: la
última pisaba a las anteriores. Los otros tres informes ya llevaban discriminante.

### R7 a R12 — lo que encontró la revisión adversarial

Cinco son defectos de código escrito **ese mismo día**, en el commit `8c2f788`. El sexto llevaba ahí
desde que existe el módulo.

**R7 — paginar al revés de lo que se rotula.** Para que la primera página del estado de cuenta
enseñara los movimientos más recientes, invertí el orden, paginé y volví a invertir. La astucia
reparte bien las filas y no pierde ninguna, pero **invierte el sentido de las páginas**: con cinco
movimientos y páginas de dos, la pantalla rotulaba «1–2 de 5» mientras enseñaba el cuarto y el
quinto, y al pulsar *Siguientes* —«3–4 de 5»— el saldo corrido **bajaba** de 150 a 60. El usuario
avanzaba en el rótulo y retrocedía en el papel.

Lo había desmontado por mi cuenta antes de conocer el hallazgo, por simplicidad —una doble
inversión es una astucia que cría errores—, y la revisión confirmó que además **era un defecto de
verdad**. Ahora pagina en orden de fecha; cuánto se debe hoy sale del resumen de cabecera, que no
depende de la página.

**R8 — quedarse sin vuelta.** El paginador se ocultaba cuando todo cabía en una página
(`total <= limit`), sin mirar el desplazamiento. Al abrir una dirección guardada de la página 2
cuando ya quedan menos filas, la tabla salía vacía, el pie seguía enseñando el total del reporte
completo y **no había ningún enlace para volver**. Además el rango podía salir del revés:
«201–120 de 120». El rótulo se extrajo al dominio para poder probarlo, y hay cuatro casos que lo
fijan.

**R9 — el quinto falso verde de la misma familia.** `UUID_PATTERN` acepta mayúsculas y el value
object guardaba el texto tal cual. PostgreSQL trata `E3000000-…` y `e3000000-…` como el mismo
identificador; los dobles en memoria comparan cadenas, así que el doble decía «no existe» donde la
base decía «Norte».

**Se arregló en la raíz, no en el doble**: `Uuid` normaliza a minúsculas, así que la corrección
alcanza a todos los contextos, no sólo a Reportes. El contrato del puerto lo exige ahora
explícitamente, y hay una prueba sobre el propio value object.

Es la **quinta vez** en este proyecto que un doble en memoria se porta distinto que la base y el
contrato pasa en verde. Las cuatro anteriores: la unicidad del nombre de rol, el turno del cerrojo,
el `tenantId` del rol, y —en esta misma revisión— el doble que guardaba la bodega sin su nombre.

**R10 — el error interno que llevaba ahí desde el principio.** Este no es de hoy: es el único
hallazgo preexistente que destapó la revisión adversarial, y es el más grave de los seis.

`report-renderer.ts:21` bautizaba la hoja de Excel con el título del documento, que en el estado de
cuenta es `Estado de cuenta — {nombre del cliente}`. Excel **prohíbe** `* ? : \ / [ ]` en el nombre
de una hoja, y ExcelJS no avisa: lanza. Reproducido:

```
Worksheet name ... cannot include any of the following characters: * ? : \ / [ ]
```

Un cliente llamado «Comercial A/B» o «Delta [SA]» —nombres perfectamente normales— hacía que su
estado de cuenta en Excel respondiera **500**, y además un 500 **genérico**: no es un error de
dominio, así que el filtro `@Catch(DomainError)` no lo toca y sale sin el mensaje público que
devuelven los demás fallos del módulo.

**Alcance exacto**, por si alguien lo busca: sólo el estado de cuenta —es el único de los cuatro
informes cuyo título lleva datos escritos por el usuario—, sólo por `?format=xlsx` —el PDF no usa el
título como nombre de hoja—, y basta con que uno de los siete caracteres aparezca en los **doce
primeros** del nombre del cliente, porque el prefijo «Estado de cuenta — » ya ocupa diecinueve de
los treinta y uno que Excel permite.

Comprobado después del arreglo contra la API viva: `200`, 6.921 bytes. El título completo se sigue
escribiendo en la primera fila de la hoja; lo que se sanea es sólo el nombre de la pestaña, que es
donde vive la restricción de Excel.

**R11 — el nombre del archivo se comía los acentos.** `«Depósito 3»` daba `dep-sito-3` y `«Bodega
Ñ»` daba `bodega-` con un guion suelto: dos bodegas que sólo se distinguieran por sus acentos
producían **el mismo archivo**, que es justo lo que R6 pretendía evitar. Ahora se translitera antes
de filtrar.

**R12 — dos errores para la misma entrada mala.** `z.coerce.number()` sin acotar aceptaba `"1.5"` y
`"0x10"` —que vale 16—, y `"  2  "` con espacios; `?offset=1e21` respondía 200 y devolvía
`"offset": 1e+21`. Según el caso el rechazo salía como `ValidationError` desde el DTO o como
`InvalidPageError` ya dentro del dominio, para entradas de la misma clase. Ahora la página pide
dígitos y nada más, acotada en el DTO. Comprobado contra la API: `0`, `501`, `abc`, `1.5`, `0x10`,
`1e3`, `-1` y `?limit=1&limit=2` dan los ocho el mismo `400 ValidationError`.

Ningún `NaN` llegaba nunca al caso de uso: eso se comprobó y estaba bien. Lo que se colaba eran las
notaciones que `Number()` acepta y una persona no escribiría.

---

## Lo que se comprobó y estaba bien

Se dice porque **ahorra volver a mirarlo**:

- **El valor del inventario coincide en los tres sitios**: Existencias, el informe de valuación y
  el tablero dan 304 con los datos de la demostración.
- **Los dos saldos del estado de cuenta no pueden divergir.** El resumen suma saldos de facturas y
  los movimientos llevan saldo corrido; son cálculos distintos sobre las mismas fuentes. Se buscó
  el caso que los separaría —un cobro aplicado a la factura de otro cliente, o un pago de más— y
  las dos puertas están cerradas (`receivable-invoice.ts:89`, `InvoiceOfAnotherCustomerError`).
- **La ruta de descarga del navegador es una lista blanca** (`reports.ts:65-90`): traduce cuatro
  nombres a cuatro rutas y escapa el identificador del cliente. No reenvía nada más a la API.
- **El periodo tiene techo de un año** y el formato desconocido se rechaza con su error de dominio.
- **`hasMore` no puede mentir**, en ningún sentido: es imposible por construcción que diga que hay
  más habiendo terminado, o al revés. Comprobado además con desplazamientos absurdos.
- **Las exportaciones siguen saliendo completas** después de paginar: la pantalla envía 50 de 160
  movimientos y el Excel descargado los trae todos.

## Dos sospechas que se cayeron al comprobarlas

Se escriben para que nadie las persiga otra vez:

- **«La antigüedad sumaría los saldos negativos en el total pero no en las filas.»** Falso:
  `aging.ts:29` descarta todo saldo menor o igual que cero, en las filas y en el total.
- **«Falta `ORDER BY` en tres consultas, así que el orden es inestable.»** Falso: los tres casos de
  uso ordenan en memoria antes de devolver.

---

## Cómo lo resuelve el sistema de referencia, y qué dice el sector

### La referencia no tiene informes

`verlumyx/erp` **no tiene módulo de reportes**. Tiene un `Dashboard`, y su controlador es esto
entero:

```php
public function index(Request $request): Response
{
    return Inertia::render('dashboard');
}
```

Una pantalla vacía, sin una sola cifra. No hay antigüedad de saldos, ni estado de cuenta, ni
valuación, ni exportación a PDF o Excel. **En este módulo la referencia no tiene nada que enseñar**,
y conviene decirlo tal cual en vez de fabricar una comparación.

### El sector

Con la referencia vacía, el contraste se apoyó entero en los ERP maduros.

**Sobre R1, el sector es explícito: que la exportación redondee distinto que la pantalla se
considera un defecto.** La precisión se fija por empresa o por moneda —la «Rounding Precision» de
Odoo, la «Currency Precision» de ERPNext— y el motor de impresión debe heredarla. La causa típica
que describen es exactamente la que tenía este sistema: la plantilla del PDF con el número de
decimales escrito a mano.

> «To change how data is presented in your report, you can modify a field's default widget
> manually» — [Odoo 18.0, Studio PDF Reports](https://www.odoo.com/documentation/18.0/applications/studio/pdf_reports.html)

**Sobre la valuación**, coincidimos en lo principal: se excluyen los artículos de servicio y los de
existencia cero, y se puede filtrar por bodega. Queda una diferencia anotada: el sector ofrece una
casilla de **«incluir artículos con existencia cero»**, que aquí no existe.

**Sobre el estado de cuenta**, el sector distingue dos variantes: **open item**, que lista cada
factura y cada cobro sin conciliar —el estándar en B2B—, y **balance forward**, que consolida lo
anterior en una línea de saldo inicial. El nuestro es open item, que es el adecuado para lo que
este sistema hace. También confirma dos cosas que ya cumplimos: nunca se incluyen documentos
anulados ni borradores, y se ordena por fecha y luego por número de documento.

---

## Lo que esta revisión NO hizo

- **No se leyó el Tablero a fondo.** Sigue con el alcance de la auditoría acotada: sus cifras están
  cuadradas contra sus informes de origen, pero no se revisó su código con esta lupa.
- **La paginación reduce lo que se envía, no lo que se lee.** La base de datos sigue leyendo todas
  las filas, porque los totales tienen que cubrirlas. Bajarlo de verdad pide una segunda consulta
  de agregado; está anotado.
- **No se revisó el rendimiento de los informes con volumen real**, más allá de las guardas que ya
  existían para la antigüedad y el tablero.
- **La moneda sigue siendo la de la empresa, siempre.** No se estudió si tiene sentido un informe
  en la moneda del documento.

---

## Lo anotado sin construir

En [`FUTURE.md`](../../FUTURE.md), cada una con su porqué: la casilla de incluir existencia cero, el
agregado propio para que la base no lea de más al paginar, y que los costos y las cantidades sigan
con sus decimales escritos a mano —no es un defecto visible, pero es la misma familia que R1—.
