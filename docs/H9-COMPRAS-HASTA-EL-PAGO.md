# H9 — Compras hasta el pago: factura, pago y saldo

**Estado:** plan aprobado, sin construir · **Escrito el 21-sep-2026**, corregido el 21 y el 22-sep-2026
tras dos validaciones multiagente, y el 28-sep-2026 contrastado con el código que dejó H8

Especificación ejecutable, escrita para que **otra sesión la ejecute** y esta la revise. Va después
de [H8](H8-NOTAS-DE-CREDITO-Y-DEVOLUCIONES.md) y antes de [H10](H10-CONTABILIDAD.md), que la
necesita (§1.2).

---

## 1. Por qué existe

### 1.1 El sistema está cojo de un lado

Medido, no estimado:

| | Ventas | Compras |
|---|---|---|
| Maestro | Clientes ✅ | Proveedores ✅ |
| Documento de pedido | Pedidos ✅ | Órdenes ✅ |
| Movimiento de mercancía | Despachos ✅ | Entradas ✅ |
| **Documento de dinero** | **Facturas ✅** | **— no existe —** |
| **Cobro / pago** | **Cobros ✅** | **— no existe —** |
| **Saldo, antigüedad, estado de cuenta** | **✅** | **— no existe —** |

Ventas llega hasta el dinero; Compras se detiene en la mercancía. El sistema sabe lo que compró y
lo que entró en bodega, y **no sabe cuánto debe ni a quién**.

Cualquiera que conozca un ERP lo nota: la simetría es lo que se lee como «completo».

### 1.2 Y la contabilidad no se sostiene sin esto

El asiento de la factura de compra es *Debe Mercancía por facturar · Haber Proveedores por pagar*
(H10 §3.4). Sin pagos a proveedores, **ninguna operación debita esa cuenta**: sólo crece, nunca
baja. La balanza cuadraría
—es una identidad, siempre cuadra— retratando una empresa que compra sin pagar jamás.

Por eso este hito va **antes** que la contabilidad y no después.

---

## 2. Alcance

### Entra

| Submódulo | Prefijo | Espejo de |
|---|---|---|
| Factura de compra | `FCP` | La factura de venta, **con diferencias reales** (§3.1) |
| Pago a proveedor | `PAG` | El cobro |
| Saldo por pagar, antigüedad y estado de cuenta | — | Cuentas por cobrar |
| Nota de crédito de proveedor | `NCP` | La que H8 dejó fuera por no tener dónde restar |

### No entra, y por qué

- **Retención de impuestos.** Ya está decidida como **hito propio** en
  [`FUTURE.md`](FUTURE.md#retención-de-impuestos-un-hito-propio-no-un-campo), con el razonamiento de
  que no vive en el impuesto sino en quién compra. Esa decisión se respeta: meter un campo de
  retención aquí sería justo el error que ese análisis descartó.
- **Límite de crédito con el proveedor.** No por falta de tiempo: **no existe en los ERP maduros**,
  y §3.7 explica por qué.
- **Programación de pagos en lote.** Armar tandas de pagos un día fijo. Es una comodidad operativa,
  no una regla; se anota.
- **Costos en destino** (repartir flete y aduana de una importación dentro del costo unitario). Es
  un módulo propio; la referencia tiene uno entero para eso.
- **Conciliación a tres bandas con aprobación.** Entra la comparación, no el flujo de aprobación
  jerárquica (§3.9).

---

## 3. Las decisiones de diseño, con su porqué

### 3.1 La factura de compra es una transcripción, no una emisión

**Decisión:** la factura de compra guarda **el número y la serie del documento del proveedor**, y
no puede registrarse dos veces la misma factura del mismo proveedor.

```prisma
@@unique([tenantId, supplierId, supplierInvoiceNumber])
```

**Por qué, y es lo que más cambia el diseño.** El sector lo dice sin rodeos:

> En ventas la empresa **emite** el documento con validez legal y el flujo busca reducir la fricción
> para cobrar cuanto antes. En compras el ERP **no genera la verdad legal**: el usuario transcribe y
> concilia el documento de un tercero, y el flujo impone **fricción deliberada** para evitar fraude.

De ahí que la identidad del documento **no sea nuestro correlativo**. Nuestro `code` sirve para
referirnos a él por dentro; quien lo identifica de verdad es el par proveedor + su número.

Y esa restricción de unicidad no es higiene de base de datos: **es un control antifraude real**.
Registrar dos veces la misma factura es la forma más común de pagar dos veces.

**Dos detalles sin los cuales el control se rodea solo**, añadidos el 21-sep-2026:

- **El número se normaliza antes de comparar**: sin espacios en los extremos y en mayúsculas. Sin
  eso, transcribir `fac-001` después de `FAC-001` esquiva el control sin querer, y el que quiera
  esquivarlo a propósito lo tiene aún más fácil.
- **Una factura anulada libera su número.** Si no, un error de captura quema el número del
  proveedor para siempre y obliga a inventarse uno. Se consigue con un índice parcial, igual que
  el `invoices_one_issued_per_dispatch` que ya existe en ventas.

### 3.2 La factura de compra no mueve inventario. Nunca

**Decisión:** ningún documento comercial mueve existencia. Sólo la mueven **el Ajuste, la Entrada y
el Despacho**, y con H8 también la Devolución, que es física.

**Por qué.** Es de la referencia, y es de lo mejor que tienen. La tenían como bandera configurable
—`affects_inventory`, sí o no— y **la eliminaron después**, con esta razón escrita en la migración:

> «Un documento comercial describe un acuerdo con un tercero —lo que se debe, lo que se cobra, lo
> que se acredita—, no un hecho físico. Dejarla escrita sólo servía para que alguien la pusiera en
> `yes` y **el stock entrara dos veces**.»

Una configuración que puede poner el inventario mal no es flexibilidad: es una trampa con
interruptor. **La regla se escribe en el código, no en una columna.**

*Nota de método: la bandera aparece en la migración que crea la tabla y desaparece en otra
posterior. Leer una migración no es leer el esquema.*

### 3.3 La diferencia de precio se resuelve con un ajuste de revaluación

**Decisión:** al confirmar una factura cuyo precio difiere del costo con que entró la mercancía, el
sistema **genera un ajuste de revaluación en borrador** que lleva **el importe** de la diferencia.
Quien lo aprueba decide cuándo; **al aprobarlo** se reparte ese importe con la existencia de ese
momento: la parte sobre lo que sigue en bodega sube (o baja) su valor, y la parte sobre lo ya
vendido va a resultado. *Reescrito el 28-sep-2026 al contrastar el plan con el código: ver
«El reparto se hace al aprobar», abajo.*

**Por qué, y aquí nos separamos de la referencia porque tiene un hueco entero.**

La referencia **no hace nada**: la factura no toca inventario ni costo por diseño, el costo que
guarda por línea es **un número muerto que nadie lee**, y la validación sólo topa cantidades —el
precio unitario admite cualquier valor, sin tolerancia, sin aviso—. La deuda queda a un valor y el
inventario a otro, y no se reconcilian nunca.

El sector explica por qué eso no se puede dejar así:

> Ningún ERP maduro la ignora, pues dejaría un saldo residual en la cuenta puente contable que
> **descuadraría la contabilidad**.

Y da el tratamiento según el método de costeo. **Nosotros usamos promedio ponderado**, así que nos
toca el primero:

> Si la empresa usa costo promedio y **la mercancía sigue en el almacén**, el ERP actualiza el valor
> del inventario para absorber la diferencia. Si el producto **ya se vendió**, no hay activo cuyo
> valor incrementar: la diferencia va al resultado del periodo.

**Lo que hace que esto sea barato:** nuestro módulo de Ajustes ya tiene el tipo `revaluation`, que
es *el único que no mueve cantidad —sus líneas sólo traen artículo y costo nuevo—*. Está
construido, revisado, con motivo obligatorio y rastro de autor.

Y el patrón tampoco es nuevo para la referencia: **su módulo de Importación ya genera un ajuste
espejo de revaluación** para repartir flete y aduana. Simplemente no lo aplicó a este caso.

**El reparto se hace al aprobar, no al facturar. Decisión de Rafael, 28-sep-2026.** La revaluación
que ya existe (`adjustment-confirmation.ts`, `revaluationEntries`) no suma un importe: fija **un
costo nuevo** a **toda** la existencia del artículo en la bodega en el momento de confirmarse. Con
el ajuste naciendo en borrador, entre la factura y la aprobación se vende y entra mercancía, y eso
rompe las dos formas ingenuas de hacerlo. Con números: entran 10 a 100 y la factura dice 110 (+100).

- **Un costo nuevo fijado al facturar** (110) está mal: si antes de aprobar entran 10 más a 90,
  aprobarlo pone las 14 a 110 y revalúa mercancía que no tiene nada que ver con esa factura.
- **Un reparto fijado al facturar** (+100 a bodega) también: si antes de aprobar se venden 6, los 4
  que quedan absorben los +100 y pasan a valer 125 en vez de 110.
- **Repartir al aprobar** es lo correcto: quedan 4, así que +40 a bodega (los 4 quedan a 110) y
  +60 a resultado.

Lo que eso pide construir:

- **Una línea de revaluación por importe**, nueva en Inventario: artículo, bodega, **cuánto sube o
  baja el valor**, y **el movimiento de entrada del que viene** (el de la línea de entrada facturada),
  en vez de un costo nuevo. Al confirmarse, reparte el importe entre lo que sigue en bodega y lo que
  ya salió desde esa entrada (§5.3, `PriceVariance`), y guarda las dos partes en la propia línea. La
  revaluación manual de siempre, por costo nuevo, no cambia.
- **Cómo se reparte, con costo promedio ponderado.** Las unidades de las distintas entradas se
  mezclan en el promedio, así que no se puede suponer que lo que queda es del lote facturado. Lo
  exacto: cada salida del artículo en esa bodega **desde el movimiento de entrada** se lleva la misma
  fracción de todo el valor, incluida la diferencia; las entradas posteriores la reparten entre más
  unidades pero no la reducen. La parte que sigue en bodega es la diferencia multiplicada, por cada
  salida, por *existencia después / existencia antes* (el kardex ya guarda `balanceQuantity` por
  movimiento). Con números:
  - Entran 10 a 100 y la factura dice 110 (+100); antes de aprobar se venden 6: 4/10 → **+40** a
    bodega y +60 a resultado.
  - Entran 10 a 100 y luego 10 a 150; se venden 15 (de 20); la factura del primer lote dice 110
    (+100): 5/20 → **+25** a bodega y +75 a resultado. *Corregido el 28-sep-2026: la versión
    anterior («si quedan menos unidades que las facturadas, la proporción que queda») daba +50.*
  - Entran 10 a 100, se venden 6, entran 10 a 90: 4/10 → **+40**, que se reparten entre las 14
    unidades del promedio nuevo.
  - Las devoluciones a proveedor **de esa misma entrada** no cuentan como salida: salen al costo
    congelado de la entrada (H8) y lo devuelto no se factura (§3.4).
- **La factura guarda la diferencia entera, pendiente**: `priceDifference`, con signo (positiva si
  la factura es más cara, negativa si es más barata). **No guarda `soldDifference`**: esa cifra no
  se conoce hasta que se aprueba el ajuste, y la guarda el ajuste.
- **Y tiene cuentas** (H10 §3.4 y §3.11): la factura lleva la diferencia a «Diferencia de precio
  pendiente», y la aprobación la salda repartiéndola entre Inventario y «Diferencia de precio de
  compra», que es de resultado —la *price difference account* del sector—.

Sin eso, la diferencia desaparecía o se asignaba a mercancía equivocada, y la contabilidad no
cerraba: justo lo que el sector advierte que pasa cuando se ignora.

**La diferencia de precio se mide en la moneda del documento. Decisión de Rafael, 28-sep-2026.**
Las entradas se valoran en la moneda de la empresa con **sus** tasas (`goods-receipt.entity.ts`), y
la factura llega con las tasas de **su** día. Si 10 unidades a USD 10 entraron a 150 Bs y la factura
dice el mismo USD 10 a 155, la diferencia de 500 Bs **no es de precio**: es de cambio. Así que:

- Una línea que cita una entrada va **en la misma moneda que esa entrada**.
- La diferencia de precio se calcula en esa moneda (precio de la factura menos precio de la
  entrada) y se lleva a la de la empresa **con las tasas de la entrada**. En el ejemplo, cero.
- Lo que separa la factura a sus tasas de la misma factura a las tasas de la entrada es
  **diferencia en cambio**, y nunca toca el inventario. La factura la guarda (`exchangeDifference`,
  con signo) y H10 la lleva a su cuenta.

**Decisión de Rafael, 28-sep-2026: el ajuste nace en borrador**, para que alguien lo apruebe. Un
ajuste que cambia el valor del inventario no se confirma solo. La referencia hace lo mismo en su
caso de importación, y encaja con la fricción deliberada del ciclo de compras. Descartado: nacer
confirmado.

### 3.4 Lo pedido ≥ lo recibido ≥ lo facturado

**Decisión:** la línea de la orden de compra gana una cantidad facturada, y la aritmética del
sector se cumple siempre.

**Por qué es barato:** ya está medio hecho. La línea de la orden ya lleva `receivedQuantity`, y
**Ventas ya hace exactamente esto**: emitir una factura actualiza la cantidad facturada de cada
línea del pedido. Es copiar un patrón propio, no inventarlo.

**Y lo devuelto no se vuelve a facturar**, añadido el 22-sep-2026. Una devolución de compra no toca
la orden (H8 §3.11): lo recibido sigue siendo lo recibido. Así que el tope de cada línea de entrada
es **lo recibido menos lo devuelto** con devoluciones confirmadas. Sin eso, una entrada de 10 con 3
devueltas admitiría una factura del proveedor por las 10.

### 3.5 Una factura cubre varias entradas, y una entrada se factura en partes

**Decisión:** la relación entre entradas y facturas es de muchos a muchos, por línea.

**Por qué.** Los dos casos son corrientes, y el sector los nombra:

- **Facturación consolidada:** un proveedor entrega cada día y factura el día 30.
- **Facturación parcial:** se recibe la máquina entera y el proveedor la cobra en dos facturas.

**Consecuencia que hay que aceptar:** la factura **no puede colgar de una entrada**. Cuelga del
proveedor, y sus líneas citan la línea de entrada que facturan. Es más trabajo que el camino fácil,
y el camino fácil no soporta ninguno de los dos casos.

**Aquí vamos por delante de la referencia, y conviene saberlo.** En su modelo **el eje
entrada-factura no existe**: la cabecera lleva un `entry_id` suelto que **ningún servicio lee jamás**
—su validación es `nullable|uuid` sin comprobar siquiera que exista—, y la factura cuelga de **una
sola orden**, sin poder consolidar dos. Las tres cantidades viven en la línea de la orden y
**nunca se comparan entre sí**.

Nosotros colgamos de la línea de entrada, que es lo que permite los dos casos y lo que hace posible
la conciliación de §3.9.

### 3.6 Se puede facturar sin entrada

**Decisión:** una factura de compra puede no tener ninguna entrada detrás.

**Por qué.** Es el camino natural de los servicios y los gastos —honorarios, alquiler, publicidad—,
que no pasan por bodega. El sistema ya distingue artículos de servicio, y Ventas ya factura
servicios sin despacho.

**Y aquí no hay contradicción con §3.2:** facturar sin entrada **no mete mercancía**. Si hubo
mercancía, hubo entrada. Si no hubo entrada, no hubo mercancía.

### 3.7 No hay límite de crédito con el proveedor

**Decisión:** no se construye el espejo del límite de crédito. Sí las **condiciones de pago**, que
ya existen en el proveedor.

**Por qué, y es la asimetría más interesante de este hito.** No es falta de tiempo: el sector
explica que no debe existir.

> El límite de crédito del cliente existe para proteger **nuestro** dinero ante impagos. En compras
> nosotros somos el deudor, y a la empresa le conviene apalancarse. Nuestro ERP no nos bloquea por
> deber demasiado: es el sistema del proveedor el que bloquea sus despachos.

Construir el espejo sería copiar la forma sin la función. **Es exactamente la trampa de la
simetría** que el sector advierte: ventas y compras comparten los documentos, no la filosofía.

### 3.8 El saldo se calcula, y en un solo sitio

**Decisión:** el saldo por pagar **no se guarda en columnas**. Se calcula, y la fórmula vive en un
único servicio de dominio que todos consumen, reporting incluido, por un puerto.

**Por qué, y esto es aprender del error propio, no del ajeno.**

La referencia guarda el saldo: `paid_amount` y `balance` en la factura, más `current_balance` en el
proveedor. **Tres cifras que alguien tiene que mantener coincidiendo**, y nada las obliga.

Nosotros elegimos lo contrario en cuentas por cobrar: el saldo se calcula. Y la revisión de
Reportes midió el precio de haberlo hecho sin disciplina: **nueve cálculos independientes de la
misma resta repartidos por dieciséis sitios**, en tres familias, con dos antigüedades y dos estados
de cuenta distintos, que hoy coinciden por construcción y no por compartir código.

**Ninguno de los dos extremos es la respuesta.** Guardarlo cuesta sincronía; calcularlo sin un solo
sitio cuesta duplicación. Cuentas por pagar nace de cero, así que puede hacerlo bien desde el
principio: **una fórmula, un sitio, y quien la necesite la pide por un puerto**.

**Esto es una restricción dura del hito.** Si al construir aparece una segunda implementación de la
resta, aunque sea en una consulta de reporte, está mal.

### 3.9 Conciliación a tres bandas: la comparación sí, la aprobación no

**Decisión:** al confirmar una factura, el sistema **compara** cantidades y precios contra la orden
y la entrada, y avisa de las diferencias. **Rechaza** facturar más cantidad de la recibida. **No
bloquea** por diferencia de precio: la resuelve con §3.3.

**Por qué esa línea y no otra.** La conciliación a tres bandas es el control característico del
ciclo de compras, y no tenerla sería un hueco visible:

> «The 3-way matching feature ensures vendor bills are only paid once some (or all) of the products
> included in the PO have been received.» —
> [Odoo 18.0](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/purchase/manage_deals/control_bills.html)

Lo que **no** entra es el flujo que va detrás: dejar la factura retenida esperando a que un
supervisor investigue. Eso pide roles de aprobación, estados de excepción y notificaciones —un hito
propio—, y a medias sería peor que nada.

**Las tolerancias se anotan**, no se construyen: con una sola empresa y sin política de compras, un
porcentaje configurable sería una perilla que nadie mueve.

**Decisión de Rafael, 28-sep-2026: facturar más cantidad de la recibida se rechaza**, con una
validación en el dominio. Es un error, no algo que se avisa: sin flujo de aprobación no hay a quién
avisar, y dejarlo pasar es justo lo que la conciliación existe para detectar. Descartado: permitirlo
con aviso. La referencia tenía las dos respuestas a la vez —su dominio lo permitía y su pantalla lo
bloqueaba—; aquí la regla vive en el dominio y la pantalla la refleja.

### 3.10 La nota de crédito de proveedor vive aquí

**Decisión:** la `NCP` entra en este hito, no en H8.

**Por qué.** H8 la dejó fuera con este razonamiento: *sin cuentas por pagar, una nota de crédito de
proveedor es un documento que no afecta a nada*. Aquí ya hay saldo del que restar, así que la
pregunta se resuelve sola.

**Y copia el diseño con que terminó su hermana de ventas. Decisión de Rafael, 28-sep-2026.** La NCC
de H8, tal como está en el código (`receivables/domain/credit-note/`):

- Si cita una factura, al confirmarse **abona sólo esa factura, hasta su saldo vivo**, con un pago
  sin dinero de forma `credit_note` que nace con ella (el **pago de emisión**, `issuePaymentId`).
- **Lo que sobra es crédito disponible con el proveedor**, calculado (total de la nota menos sus
  pagos confirmados, el `NoteCredit` de H8), nunca guardado.
- Ese crédito se **gasta desde Pagos**, eligiendo la nota en un selector, con forma `credit_note` y
  la nota como origen (`creditSourceId`). Gastar más de lo disponible se rechaza, con el mismo
  orden de bloqueo de H8: nota → pago → facturas.
- **El pago de emisión no se anula desde Pagos**: se anula anulando la nota. Y una nota con pagos
  confirmados que gastan su crédito no se anula.

Así la máquina de saldo, antigüedad y estado de cuenta no se entera de que existe un documento
nuevo, y el sistema se entiende igual por los dos lados.

**Y nunca toca el kardex** (H8 §3.1), pero puede cambiar el costo, añadido el 22-sep-2026. Una
`NCP` hace una de dos cosas:

- **Acredita una devolución de compra.** La mercancía ya salió con la devolución, al costo con que
  entró; la nota sólo baja la deuda. No revalúa nada.
- **Rebaja el precio** sin que vuelva nada. Es una factura más barata que llega tarde, y se trata
  igual que §3.3: genera **una revaluación por importe, negativa, en borrador**, que al aprobarse
  reparte la rebaja entre lo que sigue en bodega y lo vendido. Sin esto, la deuda bajaría
  y el costo de la mercancía en bodega seguiría siendo el viejo: el mismo hueco que §3.3 cierra en
  la factura, abierto por la puerta de atrás.

Cómo se contabiliza cada caso está en H10 §3.9.

---

## 4. Los submódulos, regla por regla

### 4.1 Factura de compra (`FCP`)

**Cabecera:** proveedor (obligatorio), **número y serie del proveedor** (obligatorio el número),
fecha de la factura, fecha de vencimiento, moneda con sus tasas congeladas, notas. Y los importes,
derivados de las líneas: subtotal, impuesto, total.

**Sin descuento global, flete ni otros cargos en la cabecera. Decisión de Rafael, 28-sep-2026.** La
factura de venta tampoco los tiene, el flete es justo el «costo en destino» que este hito deja fuera
(§2), y H10 no tenía dónde asentarlos. Si el proveedor cobra flete u otro cargo, va como **una
línea de servicio** (a «Gasto de compras»); un descuento, en el precio de cada línea.

**Líneas:** artículo o concepto, cantidad, precio unitario, impuesto, y **qué factura**:
- **Una línea de entrada** (mercancía que pasó por bodega), o
- **Una línea de orden de un servicio** (las órdenes de compra admiten servicios, que nunca pasan
  por una entrada: `purchase-order-references.ts`, `movesStock: item.type !== 'service'`), o
- **Nada**: un servicio o gasto sin orden (honorarios, alquiler).

**Reglas al confirmar:**

1. **No existe ya** una factura de ese proveedor con ese número (§3.1).
2. La fecha no es futura (la regla ya existe en Ventas y se reutiliza) y el vencimiento no es
   anterior a la fecha de la factura. **Esta segunda es nueva**: en Ventas el vencimiento no se
   captura, se calcula (`invoice.entity.ts`, fecha + días de crédito). Aquí se transcribe del
   documento del proveedor; la pantalla lo propone con las condiciones de pago del proveedor y
   deja cambiarlo.
3. Cada línea con entrada de origen: la cantidad facturada **no supera la recibida menos la
   devuelta**, contando las facturas confirmadas anteriores (§3.4). Lo devuelto se suma de las
   líneas de devolución confirmadas de esa línea de entrada, **con la misma consulta que ya calcula
   el cupo de devolución** (`/api/v1/purchasing/receipts/:id/return-quota`), no con una segunda.
   Cada línea que cita una **línea de orden de servicio**: no supera lo pedido menos lo ya facturado.
   Es una lectura seguida de una escritura, así que **necesita su orden de bloqueo, compatible con
   el que ya existe**: las entradas bloquean entrada → orden → existencias
   (`prisma-receipt-posting.ts`), y las devoluciones de compra, devolución → entrada → existencias,
   **leyendo la orden sin bloquearla** (`prisma-purchase-return-posting.ts`). La factura: factura →
   entradas citadas (en orden de id, para que dos facturas no se crucen) → órdenes, con `FOR UPDATE`
   en la misma transacción. *Corregido el 28-sep-2026: decía que las devoluciones bloquean la orden,
   y no lo hacen.* Sin él, dos facturas
   confirmadas a la vez sobre las mismas líneas pasan las dos la comprobación y **suman por encima
   de lo recibido**. Lleva prueba de concurrencia en el contrato del puerto, que es donde este
   proyecto ya demostró que esas pruebas son deterministas.
4. Todas las entradas citadas son **del mismo proveedor** y están confirmadas, y cada línea que
   cita una línea de entrada lleva **su mismo artículo y su misma unidad**.
5. Los totales se derivan de las líneas. **Nunca se capturan.**
6. Si algún precio difiere del costo de entrada, **genera la revaluación por importe, en
   borrador** (§3.3): **una por bodega**, porque un ajuste es de una sola bodega y una factura puede
   citar entradas de varias, y **una línea por línea de entrada** con diferencia. Cada ajuste lleva
   su origen (la factura), para encontrarlo al anular.
7. **No toca el inventario** por ninguna otra vía (§3.2).

**Al anular:** devuelve la cantidad facturada a las líneas de la orden, y **trata cada revaluación
según su estado**: si está en borrador la anula; si está confirmada, **genera otra revaluación por
importe, del importe contrario y en borrador**, citando la misma entrada, que al aprobarse se
reparte igual; y si ya estaba anulada no hace nada. **No se deshacen sus movimientos del kardex**:
anular hoy un ajuste revierte sus movimientos (`adjustment-cancellation.ts`), y eso falla o da
cifras falsas si desde entonces se vendió parte. *Corregido el 28-sep-2026.*
Una factura con pagos confirmados no se anula —misma regla que Ventas—.

### 4.2 Pago a proveedor (`PAG`)

Espejo del cobro, y aquí la simetría **sí** es real: mismo ciclo, mismo reparto, misma anulación.

**Cabecera:** proveedor, fecha, forma de pago, referencia, importe, moneda con sus tasas.

**Reparto:** entre varias facturas del mismo proveedor, como el cobro. El sector lo confirma: *un
solo comprobante se reparte para liquidar parcial o totalmente varias facturas*.

**El reparto es el del cobro, tal como está:** una fila por factura y pago
(`@@unique([paymentId, invoiceId])` en `PaymentAllocation`), y anular el pago cambia su estado sin
borrar el reparto. *Corregido el 28-sep-2026: la versión anterior proponía copiar de la referencia
filas «revertidas» marcadas una a una, que nuestro cobro no tiene; se copia lo nuestro.*

**Reglas:** no se paga más que el saldo de cada factura; no se pagan facturas de otro proveedor; no
se paga una factura anulada. Las tres ya existen en cobros y se copian con su porqué.

**Formas de pago:** las mismas que el cobro, más `credit_note` para §3.10.

### 4.3 Saldo, antigüedad y estado de cuenta del proveedor

Espejo de Cuentas por cobrar, **con el saldo en un solo sitio** (§3.8).

- **Facturas por pagar:** listado con su saldo, su estado de cobranza y su tramo.
- **Antigüedad de saldos por pagar:** los mismos cinco tramos que los del cliente. **Reutilizar el
  cálculo de tramos**, no escribir un tercero: ya hay dos.
- **Estado de cuenta del proveedor:** facturas y pagos con saldo corrido.

**Y en Reportes:** la antigüedad por pagar exportable y la cifra en el tablero. Eso es trabajo de
H9, no de después: un tablero que enseña lo que cobramos y no lo que debemos está a medias.

### 4.4 Nota de crédito de proveedor (`NCP`)

Las reglas de H8 §4.2 y §3.10, con proveedor en vez de cliente y pago en vez de cobro (§3.10). Y
el cupo de importe contra la factura de compra (H8 §3.3).

**Una regla de H8 no se copia tal cual:** la de cliente exige que la devolución que acredita sea
«del mismo pedido» que la factura (H8 §4.2). Una factura de compra junta entradas de varias órdenes
(§3.5), así que aquí la regla es: **las líneas de la devolución son de líneas de entrada que esa
factura facturó.**

**Y las dos propias** (§3.10): si acredita una devolución, la devolución existe, está confirmada,
es del mismo proveedor y no la acredita ya otra nota confirmada; si rebaja el precio, genera la
revaluación por importe con las mismas reglas que la factura, incluida su anulación (§4.1).

---

## 5. El esqueleto

### 5.1 Dónde vive cada cosa

**Decisión: un contexto nuevo, `payables`**, espejo de `receivables`. La factura de compra vive en
`purchasing` —es el documento del ciclo de compra, como la factura de venta vive en `sales`— y el
pago, el saldo y la antigüedad viven en `payables`.

Es la misma repartición que ya funciona del otro lado, y la convención dice **explícito sobre
automático**: dos contextos con la misma frontera que sus espejos se entienden solos.

### 5.2 Base de datos

Tres tablas de cabecera y tres de líneas —factura, pago y nota de crédito, cada una con las
suyas—, con el patrón exacto de `Invoice` / `InvoiceLine`:
`id` uuid, `tenantId`, `code`, moneda con sus cuatro columnas congeladas, importes
`Decimal(18, 4)`, `@@unique([tenantId, id])` y relaciones compuestas por `[tenantId, id]`.

```prisma
model PurchaseInvoice {
  // Quien identifica esta factura NO es nuestro code: es el numero que le puso el proveedor.
  supplierInvoiceNumber String  @map("supplier_invoice_number") @db.VarChar(60)
  supplierInvoiceSeries String? @map("supplier_invoice_series") @db.VarChar(20)

  // Se guarda ya normalizado (sin espacios en los extremos y en mayusculas): lo hace la entidad
  // al construirse, asi la unicidad compara lo mismo que compara una persona.
  // Registrar dos veces la misma factura es la forma mas comun de pagar dos veces. La unicidad NO
  // va aqui: Prisma no expresa indices parciales, y la anulada tiene que liberar su numero (§3.1).
  // Va en la migracion, como invoices_one_issued_per_dispatch en ventas.
}
```

```sql
CREATE UNIQUE INDEX "purchase_invoices_one_active_number_per_supplier"
  ON "purchase_invoices" ("tenant_id", "supplier_id", "supplier_invoice_number")
  WHERE "status" <> 'cancelled';
```

*Corregido el 22-sep-2026: el esquema traía `@@unique([tenantId, supplierId,
supplierInvoiceNumber])`, una unicidad simple que no libera el número al anular y compara sin
normalizar, justo lo contrario de lo que decide §3.1.*

```prisma
model PurchaseInvoiceLine {
  // Que linea de que entrada factura. Nula en servicios y gastos, que no pasan por bodega.
  receiptLineId String? @map("receipt_line_id") @db.Uuid
  // Que linea de orden de un servicio factura (los servicios de una orden no pasan por entrada).
  // Como mucho una de las dos referencias; ninguna en un gasto sin orden.
  orderLineId   String? @map("order_line_id") @db.Uuid
}

model PurchaseInvoice {
  // La diferencia de precio entera, en la moneda de la empresa a las tasas de la entrada. Con signo:
  // negativa si la factura es mas barata. Queda pendiente hasta que se aprueba su revaluacion, que
  // es quien la reparte entre bodega y resultado (§3.3).
  priceDifference Decimal @default(0) @map("price_difference") @db.Decimal(18, 4)
  // Lo que separa la factura a sus tasas de la misma factura a las tasas de las entradas. No es
  // precio y no toca el inventario (§3.3). Con signo.
  exchangeDifference Decimal @default(0) @map("exchange_difference") @db.Decimal(18, 4)
  // Las revaluaciones que genera no se guardan aqui: cada ajuste lleva su origen (tipo y id del
  // documento), porque son una por bodega (§4.1).
}

model PurchaseOrderLine {
  // Espejo de invoicedQuantity en la linea del pedido de venta.
  invoicedQuantity Decimal @default(0) @map("invoiced_quantity") @db.Decimal(18, 4)
}
```

Más `SupplierPayment` y `SupplierPaymentAllocation`, calcados de `CustomerPayment` y
`PaymentAllocation`, con `credit_note` en su enum de formas de pago y la columna de origen. Y
`SupplierCreditNote` con sus líneas, calcadas de las de la `NCC` de H8 (incluido su pago de
emisión), con la devolución que acredita (opcional) y las mismas `priceDifference` y
`exchangeDifference` que la factura.

Y en Inventario, **la línea de revaluación por importe** (§3.3). Una revaluación sigue siendo un
ajuste de tipo `revaluation`; lo que cambia es la línea, que dice de cuál de las dos clases es:

```prisma
model AdjustmentLine {
  // 'cost': la de siempre, fija un costo nuevo (unitCost). 'amount': suma o resta un importe (H9 §3.3).
  revaluationKind   RevaluationKind? @map("revaluation_kind")
  amount            Decimal?         @db.Decimal(18, 4)
  // El movimiento de entrada desde el que se mide lo que ya salio (PriceVariance, H9 §5.3).
  sourceMovementId  String?          @map("source_movement_id") @db.Uuid
  // El reparto, escrito al confirmar.
  stockPart         Decimal?         @map("stock_part") @db.Decimal(18, 4)
  soldPart          Decimal?         @map("sold_part") @db.Decimal(18, 4)
}

model Adjustment {
  // Quien lo genero, si no fue una persona: 'purchase_invoice' o 'supplier_credit_note' y su id.
  // Sin esto no hay forma de encontrar las revaluaciones de una factura al anularla (§4.1).
  originType String? @map("origin_type") @db.VarChar(30)
  originId   String? @map("origin_id") @db.Uuid
}
```

- **Si al aprobar ya salió todo**, la línea por importe se confirma igual: todo va a resultado
  (`soldPart`) y no escribe movimiento de kardex. La revaluación por costo nuevo sigue lanzando
  `NothingToRevalueError` sin existencia (`adjustment-confirmation.ts`); la por importe, no.
- Cuando sí queda existencia, la parte de bodega entra al kardex **como hoy entra una
  revaluación** (sale todo al costo viejo y vuelve a entrar al nuevo), con el costo nuevo calculado
  al confirmar: (valor actual + `stockPart`) / existencia actual.

### 5.3 Dominio

- `PurchaseInvoice` con su ciclo de vida y sus invariantes.
- **`PayableBalance`: la fórmula del saldo, en un solo sitio** (§3.8). Es la pieza que decide si
  este hito envejece bien. Y se publica como puerto, con nombre, porque decir «por un puerto» sin
  nombrarlo es como no decirlo:

  ```ts
  export const PAYABLE_BALANCES = Symbol('PayableBalances');

  // El unico sitio del sistema que resta lo pagado de lo facturado. Reporting y contabilidad lo
  // consumen por aqui; si aparece una segunda resta en una consulta, esta mal.
  export interface PayableBalances {
    ofSupplier(tenantId: TenantId, supplierId: SupplierId): Promise<SupplierExposure>;
    ofInvoice(tenantId: TenantId, invoiceId: PurchaseInvoiceId): Promise<Money>;
  }
  ```
- `ThreeWayMatch`: el servicio que compara orden, entrada y factura y devuelve las diferencias.
- `PriceVariance`, **en Inventario**: al confirmar la revaluación por importe, reparte la
  diferencia entre lo que sigue en bodega y lo que ya salió **desde el movimiento de entrada**
  (§3.3). La fórmula, en un solo sitio y con sus pruebas: la parte en bodega es el importe por el
  producto, en cada salida desde ese movimiento, de *existencia después / existencia antes*; el
  resto va a resultado. Lo que devuelve viaja en el evento de contabilidad del ajuste (H10 §4.4).
- `PurchasePriceDifference`, **en Compras**: calcula, al confirmar la factura o la nota, la
  diferencia de precio en la moneda del documento llevada a la de la empresa con las tasas de la
  entrada, y la diferencia en cambio (§3.3). La usan la factura y la nota.
- Los errores, con `publicMessage` sin identificadores y **dados de alta en el
  `error-categories.spec.ts`** de su contexto.

### 5.4 Los correlativos

Una línea por contexto, como en H8:

```ts
export type PurchasingCodePrefix = 'PRV' | 'OC' | 'ENT' | 'DVC' | 'FCP'; // DVC ya existe desde H8
export type PayablesCodePrefix = 'PAG' | 'NCP';
```

### 5.5 Aplicación, API e interfaz

Lo de siempre por documento: crear, editar, confirmar, anular, buscar **paginado** y ver detalle.
DTO de Zod estrictos, un permiso por documento en el catálogo, `data-testid` al escribir el
componente, errores traducidos por código.

---

## 6. Fases

- [ ] **0. Esquema y correlativos** — tablas, la cantidad facturada en la línea de orden, los
      prefijos. Sin lógica.
- [ ] **1. Factura de compra** — dominio, la unicidad del número del proveedor, la aritmética de
      cantidades, API y pantallas. **Sin** diferencia de precio todavía.
- [ ] **2. Conciliación a tres bandas** — la comparación y el rechazo por cantidad (§3.9).
- [ ] **3. La diferencia de precio** — la revaluación por importe en Inventario, su reparto al
      aprobar, y la diferencia en cambio
      (§3.3). Va sola porque es la pieza con más riesgo.
- [ ] **4. Pago a proveedor** — con su reparto, espejo del cobro.
- [ ] **5. Saldo, antigüedad y estado de cuenta** — con la fórmula en un solo sitio (§3.8).
- [ ] **6. Reportes** — antigüedad por pagar exportable y la cifra en el tablero.
- [ ] **7. Nota de crédito de proveedor** (§3.10).
- [ ] **8. Semillas y extremo a extremo.**
- [ ] **9. Revisión** con `module-review`, modo «fase ya construida».

---

## 7. Las pruebas que no pueden faltar

| Qué defiende | La prueba |
|---|---|
| §3.1 | Registrar dos veces la misma factura del mismo proveedor **se rechaza**; el mismo número de **otro** proveedor se acepta |
| §3.2 | Confirmar una factura de compra **no cambia ninguna existencia** |
| §3.3 | Factura más cara que la entrada, con mercancía en bodega: se genera la revaluación y la valuación del inventario sube |
| §3.3 | El mismo caso con la mercancía **ya vendida entera** al aprobar: la revaluación se confirma, manda todo a resultado y no escribe kardex |
| §3.3 | Factura **más barata** que la entrada, parte en bodega y parte vendida: reparto negativo en las dos partes |
| §3.3 | **Se vende entre la factura y la aprobación** (10 a 100, factura 110, se venden 6): al aprobar, +40 a bodega (quedan a 110) y +60 a resultado |
| §3.3 | **Entra mercancía entre la factura y la aprobación** (10 a 100, se venden 6, entran 10 a 90): van +40 a bodega, repartidos entre las 14 unidades |
| §3.3 | **Dos entradas a distinto precio antes de facturar** (10 a 100, 10 a 150, se venden 15, factura del primer lote a 110): +25 a bodega y +75 a resultado |
| §3.3 | Una devolución a proveedor de esa misma entrada, entre la factura y la aprobación, **no** cuenta como salida en el reparto |
| §4.1 | Anular una factura con su revaluación **ya confirmada** y parte vendida: genera la revaluación contraria en borrador, y no toca el kardex de la original |
| §4.1 | Una línea de servicio que cita una línea de orden: marca lo facturado y no supera lo pedido |
| §3.3 | Factura en USD al mismo precio que la entrada pero con otra tasa: **diferencia de precio cero** y la de cambio en `exchangeDifference` |
| §3.3 | Una factura que cita entradas de **dos bodegas** genera **dos** revaluaciones |
| §3.4 | Facturar más cantidad de la recibida se rechaza, y también facturar lo que ya se devolvió |
| §3.5 | Una factura cubre dos entradas; y una entrada se factura en dos facturas. **Los dos casos** |
| §3.6 | Una factura de sólo servicios, sin ninguna entrada, se confirma |
| §3.8 | El saldo que dicen el listado, la antigüedad, el estado de cuenta y el tablero es **el mismo** |
| §3.1 | `FAC-001` y `fac-001` del mismo proveedor son **la misma factura**; anular una **libera** su número |
| §4.1 | Dos facturas confirmadas **a la vez** sobre las mismas líneas de entrada no suman por encima de lo recibido |
| §4.1 | Anular una factura cuyo ajuste de revaluación está **en borrador** lo descarta; si está confirmado lo revierte |
| §3.3 | La revaluación manual por costo nuevo **sigue funcionando igual** |
| §3.10 | La `NCP` por más de lo que debe la factura abona hasta el saldo; el resto se gasta desde Pagos, y gastar de más se rechaza |
| §3.10 | El pago de emisión de una `NCP` no se anula desde Pagos; una `NCP` con pagos aplicados no se anula |
| §4.2 | Pagar más que el saldo se rechaza; pagar facturas de otro proveedor se rechaza |
| §3.10 | Una `NCP` de rebaja sobre mercancía en bodega **baja su costo** por revaluación; una que acredita una devolución **no** revalúa |

---

## 8. Riesgos

**El grande: §3.3 es la pieza más difícil del hito**, porque toca el costo del inventario desde un
documento que por regla no lo toca (§3.2). La contradicción es aparente —quien revaloriza es el
Ajuste, no la factura— pero es fina, y quien la construya deprisa va a acabar escribiendo en el
kardex desde `purchasing`. **Por eso va en fase propia y después de que todo lo demás esté en
verde.**

Y desde el 28-sep-2026 toca además el módulo de Ajustes de H3: la revaluación por importe es un tipo
de línea nuevo sobre código revisado y en producción. La revaluación por costo nuevo **no cambia**,
y su prueba de que sigue igual es obligatoria.

**El segundo: la tentación de guardar el saldo.** Es más fácil y es lo que hace la referencia.
§3.8 explica por qué no, y la prueba de que las cuatro cifras coinciden es la que lo defiende.

**El tercero: creer que compras es ventas del revés.** El sector avisa de que es un error clásico
de implementación. Aquí se concreta en tres sitios: no hay límite de crédito (§3.7), la factura se
transcribe en vez de emitirse (§3.1), y existe una conciliación que en ventas no tiene sentido
(§3.9).

---

## 9. Lo que este plan NO resuelve

Retención de impuestos —hito propio ya decidido—, programación de pagos en lote, costos en destino,
el flujo de aprobación de la conciliación, las tolerancias configurables y el límite de crédito con
el proveedor, que no debe existir. Cada uno con su porqué en `FUTURE.md`.
