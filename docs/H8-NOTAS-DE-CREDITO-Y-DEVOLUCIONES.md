# H8 — Notas de crédito y devoluciones

**Estado:** plan aprobado, sin construir · **Escrito el 20-sep-2026**, corregido el 21 y el 22-sep-2026
tras dos validaciones multiagente

Este documento es la **especificación ejecutable** del hito: contiene las reglas de negocio de
cada submódulo, el esqueleto técnico y el orden de construcción. Está escrito para que **otra
sesión lo ejecute** y esta lo revise.

> **Regla que manda sobre todo lo demás:** nada de esto se construye a ciegas. Cada fase cierra con
> `make verify` en verde, y cada regla nueva llega con la prueba que fallaría sin ella. Las reglas
> de [`AGENTS.md`](../AGENTS.md) y la convención de [`ARCHITECTURE.md`](ARCHITECTURE.md) no se
> negocian.

---

## 1. Por qué existe

Hoy un cliente puede devolver mercancía y **el sistema no tiene cómo registrarlo**. Lo único
parecido es anular la factura, y anular no es acreditar: borra el documento en vez de dejar rastro
de que hubo una venta y luego una devolución.

El sistema ya sabe que le falta. En `reporting`, el comentario del estado de cuenta afirma que el
último saldo coincide con lo que deben las facturas, **con la nota de que dejará de ser cierto en
cuanto existan notas de crédito**. Esa frase es la deuda escrita a mano.

**Qué dice el sector**, investigado el 20-sep-2026:

> «a credit note (or credit memo) is the legal document used to cancel, refund, or modify a
> validated invoice» — [Odoo 17.0, Credit Notes](https://www.odoo.com/documentation/17.0/applications/finance/accounting/customer_invoices/credit_notes.html)

Y lo que más nos afecta: **los ERP maduros prohíben anular una factura ya validada.** Rompe la
inmutabilidad y la correlatividad fiscal; obligan a emitir una nota de crédito que neutralice el
efecto dejando rastro de las dos acciones. Nosotros sí dejamos anular —con la guarda de que una
factura con cobros confirmados no se anula—. **Esa incoherencia se decide en §3.6.**

**Qué tiene el sistema de referencia.** `verlumyx/erp` tiene los cuatro documentos y los anticipos.
Se leyó su código, no su documentación, y de ahí salen las decisiones de §3 —incluidas **cuatro donde
nos separamos de él a propósito**, porque se le encontraron defectos: dos en §3.3, uno en §3.4 y otro en §3.8.

---

## 2. Alcance

### Entra

| Documento | Prefijo | Qué mueve |
|---|---|---|
| Nota de crédito a cliente | `NCC` | Dinero: baja lo que el cliente debe |
| Devolución de venta | `DVV` | Mercancía: reingresa a bodega |
| Devolución de compra | `DVC` | Mercancía: sale de bodega |

**Tres documentos, no cuatro.** La nota de crédito de proveedor se fue a
[H9](H9-COMPRAS-HASTA-EL-PAGO.md) §3.10, que es donde existe el saldo del que restar (§4.4).

### No entra, y por qué

- **Notas de débito.** Aumentan la deuda del cliente por recargos o fletes. Son el reverso exacto y
  no añaden ninguna regla nueva: puro trabajo repetido. Se anotan en `FUTURE.md`.
- **Anticipos de cliente y de proveedor.** La referencia los tiene, y comparten el mecanismo con
  las notas de crédito (§3.2). Se dejan fuera para no hacer el hito enorme, **pero el mecanismo se
  construye pensando en ellos**: añadirlos después debe ser un origen más, no un rediseño.
- **Series y correlativos fiscales.** La referencia distingue `code` interno de `note_series` +
  `note_number` fiscal, que se quema al confirmar. Nosotros no modelamos facturación electrónica
  ni numeración fiscal en ningún documento, y empezar aquí sería incoherente con el resto.
- **Bodega de cuarentena.** La referencia manda la mercancía dañada a una bodega aparte. Nosotros
  no tenemos el concepto; la condición se registra igual (§3.5) y la bodega la elige quien recibe.

---

## 3. Las decisiones de diseño, con su porqué

Estas once decisiones son **lo que hay que respetar al construir**. Si al ejecutar alguna resulta
imposible o equivocada, se para y se consulta: no se improvisa una alternativa.

### 3.1 La nota de crédito y la devolución son dos documentos distintos

**Decisión:** dos documentos independientes, con su tabla, su correlativo y su ciclo de vida, que
se enlazan opcionalmente uno a uno. **Ninguno genera al otro automáticamente.**

**Por qué.** Coinciden la referencia y el sector, por la misma razón: son dos ejes distintos.

> «La Devolución de mercancía es un documento **logístico** procesado por el almacén. La Nota de
> Crédito es un documento **financiero** procesado por contabilidad.»

Y hay casos reales de cada uno por separado: un cliente devuelve mercancía esperando **reemplazo**,
sin querer dinero de vuelta —devolución sin nota—; o se concede un **descuento posterior** sin que
vuelva nada —nota sin devolución—.

**Quién decide el vínculo: la nota.** Es quien elige a qué devolución acredita. La devolución no
sabe si acabará acreditada.

| | Devolución (`DVV`/`DVC`) | Nota de crédito (`NCC`/`NCP`) |
|---|---|---|
| Eje | Mercancía | Dinero |
| Toca el kardex | **Sí** | **Nunca** |
| Toca el saldo | No | **Sí** |
| Puede existir sola | Sí | Sí |

### 3.2 La nota de crédito NO toca el saldo directamente: genera un cobro sin dinero

**Decisión:** confirmar una nota de crédito a cliente que cita una factura **crea un cobro
confirmado** con forma de pago `credit_note`, cuyo origen apunta a la nota, aplicado a esa factura
hasta lo que todavía debe. Lo que sobra queda como crédito de la nota y se gasta después desde
Cobros, con otros cobros sin dinero iguales a éste (§3.10). El saldo baja siempre por la máquina de
siempre.

**Por qué, y es la decisión más importante del hito.** El mapa del código encontró que **el saldo
de una factura se toca en dieciséis sitios independientes** —nueve que lo calculan y siete que lo
consumen—, en tres familias que hoy coinciden por construcción y no por compartir código:

| Familia | Dónde | Sitios |
|---|---|---|
| SQL | `receivables` y `reporting` | 5 |
| TypeScript sobre `ReceivableInvoice` | `receivables` | 7 |
| TypeScript sobre el modelo de lectura | `reporting` (código separado) | 4 |
| **Total** | | **16** |

**Dieciséis sitios, de los cuales nueve calculan la resta y siete la consumen.** La versión anterior
de esta sección decía «nueve» junto a una tabla que suma dieciséis, sin reconciliar las dos cifras.
La distinción importa: los que **calculan** hay que mantenerlos coincidiendo; los que **consumen**
—`ensureAccepts`, `collectionStatus`, `daysOverdue`, el control de crédito— heredan el resultado, y
rompen igual si el número cambia.

Hay **dos implementaciones distintas de la antigüedad de saldos** y **dos del estado de cuenta**.
Todas parten de la misma resta: `total − suma de repartos de cobros confirmados`.

Un documento nuevo que redujera el saldo por su cuenta obligaría a **tocar los dieciséis**, y a
mantener coincidiendo para siempre los nueve que calculan. Un cobro sin dinero **no obliga a tocar
ninguno de los cálculos**: todos leen repartos de cobros confirmados, y el de una nota lo es.

**Lo único que sí hay que tocar** es donde se *nombra* el movimiento, para que el estado de cuenta
no diga «Cobro NCC000001» sino «Nota de crédito NCC000001». Son dos sitios, los dos estados de
cuenta, y es presentación, no cálculo.

**Y prepara los anticipos**: un anticipo será otra fuente de crédito que se gasta desde Cobros,
exactamente como la nota (§3.10).

### 3.3 El cupo de cantidad y el cupo de importe son distintos

**Decisión:** dos topes separados, cada uno con su guarda.

- **Cupo de cantidad**, por línea **de despacho** en ventas y por línea **de entrada** en compras:
  la suma de lo devuelto no puede superar lo que salió o lo que entró. Lo consumen **las
  devoluciones**.
- **Cupo de importe**, por factura: la suma de lo acreditado no puede superar el total. Lo consumen
  **las notas de crédito**.

**Por qué nos separamos de la referencia.** Ahí está uno de sus defectos: las dos cantidades se
cuentan con **consultas independientes que no se miran**, así que *nada impide devolver diez
unidades y acreditar otras diez de la misma línea facturada de diez*. El cupo se consume dos veces.

Sumarlos en un solo cupo sería peor: una nota que acredita una devolución se refiere **a las mismas
unidades**, y contarlas dos veces impediría lo normal. Separar los ejes resuelve los dos casos: un
descuento global gasta importe sin gastar unidades, una devolución gasta unidades, y el tope de
importe sigue cerrando el total.

**Por qué el cupo de cantidad va por despacho y no por factura**, decidido con Rafael el
22-sep-2026. La referencia lo pone por línea de factura, y en los dos sistemas **se puede facturar
antes de despachar**: aquí `linesToInvoice(null)` factura todo lo pendiente de un pedido confirmado
(`sales-order.entity.ts:206-209`), y allí la factura nace del pedido y, sin despacho, se queda con
un *«costo provisional»* (`SalesInvoicePostingService`). Con el cupo por factura, **se podría
devolver mercancía que nunca salió**: reingresaría existencia que no existe, a un costo que nadie
pagó. Es el cuarto defecto de la referencia que no copiamos.

Con el cupo por despacho el problema no puede aparecer: sólo se devuelve lo que salió, y el
movimiento de kardex de esa línea de despacho es el que da el costo (§3.4). La factura sigue
teniendo su tope, que es el de importe.

### 3.4 La mercancía devuelta se valora al costo congelado, en los dos lados

**Decisión:** una línea de devolución **guarda su costo unitario**, tomado del movimiento de kardex
que revierte. En venta y en compra. Nunca al promedio vigente.

**Por qué.** El sector es tajante:

> Vuelve a entrar al **costo de la venta original**, no al costo promedio de hoy. Si se reingresara
> al promedio actual, el asiento que revierte el costo de ventas no sería el espejo exacto de lo
> que salió, **inyectando variaciones y ganancias o pérdidas ficticias** en la contabilidad.

La referencia lo hace **sólo en ventas**, y su comentario da exactamente ese razonamiento: *«si se
valorara al promedio, devolver mercancía inventaría o destruiría margen sin que nadie comprara ni
vendiera nada»*. En **compras no lo aplicó**: su tabla de líneas de devolución de compra ni
siquiera tiene columna de costo, y la mercancía sale al promedio vigente.

El argumento vale igual en los dos lados. **Nosotros lo hacemos simétrico.**

**Lo que ya tenemos a favor.** El kardex (`inventory_movements`) guarda por movimiento:
`unitCost`, `originType`, `originId`, `originLineId`, y `reversalOfId`. El concepto existe; falta
**revertir líneas sueltas**, porque hoy `StockMovements.reverse()` revierte el documento entero.

**Y una invariante que hay que cambiar, descubierta el 21-sep-2026.** El esquema declara
`@@unique([reversalOfId])` con el comentario *«Un movimiento se revierte una sola vez: anular dos
veces no puede duplicar la contrapartida»*. Esa restricción **hace imposibles las devoluciones
parciales**, que son el caso normal: devolver tres unidades de diez y después dos más genera dos
movimientos que citan **el mismo** original, y el segundo viola la unicidad.

**Decisión:** la reversión por anulación y la devolución parcial son **dos cosas distintas y no
comparten columna**.

- `reversalOfId` se queda **exactamente como está**, con su unicidad, para lo que se construyó:
  anular un documento entero. Esa invariante es correcta y no se toca.
- La devolución usa una columna nueva en el kardex, `restoresMovementId`, **sin unicidad**, que
  dice de qué salida procede el costo congelado. Varias devoluciones pueden citar la misma salida.
- **Las dos conviven sin pisarse.** El movimiento que publica una devolución cita su origen por
  `restoresMovementId`. Si después se anula la devolución, su movimiento se revierte por
  `reversalOfId`, uno a uno, como cualquier anulación: la unicidad se sigue cumpliendo.

**Quien impide devolver de más no es la base de datos, es el cupo de cantidad** (§3.3). Confundir
las dos cosas fue el error: una restricción de unicidad estaba haciendo de tope de negocio, y por
eso topaba en uno.

### 3.5 La devolución declara en qué estado vuelve la mercancía

**Decisión:** cada devolución lleva una condición con tres valores.

| Condición | Qué hace |
|---|---|
| `resalable` | Reingresa a la bodega elegida, al costo congelado |
| `damaged` | Reingresa igual, marcada: se puede consultar y decidir después |
| `scrap` | **No reingresa nada.** La mercancía se destruye |

**Por qué.** Es de la referencia y es buena: separa «volvió» de «vale algo».

> **Corregido el 21-sep-2026.** Esta sección decía que con `scrap` *«la pérdida se registra por
> Ajuste»*. **Es imposible, y además no hace falta.**
>
> Imposible porque la mercancía **ya salió con el despacho** y nunca reingresó: el kardex la da por
> ida. Un ajuste que intentara descontarla otra vez chocaría con `InsufficientStockError`
> (`item-stock.entity.ts:120`), porque no hay existencia que quitar.
>
> Y no hace falta porque **la pérdida de un `scrap` no es de inventario, es financiera**: se
> devuelve dinero al cliente sin recuperar mercancía vendible. **La pérdida ya está contabilizada**:
> el despacho cargó su costo a Costo de ventas, y como la mercancía no reingresa, ese costo no se
> revierte nunca. La **nota de crédito** revierte el ingreso (H10 §3.7), y entre las dos queda
> exactamente lo perdido (H10 §3.10). El inventario ya estaba bien.
>
> Lo que sí queda anotado es la condición, para que alguien pueda preguntar cuánto se acreditó sin
> recuperar nada.

**Ojo al construir:** con `scrap` la devolución **no genera movimiento de kardex**, pero sí puede
generar nota de crédito. Es el caso que separa los dos ejes y **tiene que tener prueba propia**.

### 3.6 Anular una factura se restringe, no se retira

**Decisión:** una factura que tenga **alguna nota de crédito o devolución** ya no se anula. El
mensaje dice qué hacer: emitir una nota de crédito por el resto.

**Por qué no se retira del todo.** El sector prohíbe anular porque una factura validada es un
documento fiscal con correlativo. **Nosotros no modelamos correlativos fiscales**, y anular una
factura recién emitida por un error de captura es legítimo y cómodo. Retirarlo sería copiar una
regla sin copiar la razón que la sostiene.

**Por qué no se deja como está.** Porque una factura con notas de crédito **sí** tiene vida
posterior, y anularla dejaría las notas apuntando a un documento que ya no existe.

Hoy la guarda es `if (paid > 0) throw InvoiceWithPaymentsError`. Como una nota genera un cobro
(§3.2), **esa guarda ya cubre la mitad del caso sola**: una factura acreditada tiene un cobro y no
se anula.

**Falta cubrir la devolución sin nota, y así se hace:** `InvoiceCanceller` consulta un puerto nuevo
—`SalesReturnsOfInvoice`— que responde cuántas devoluciones confirmadas devuelven mercancía de
**alguna línea de pedido que esa factura facturó**, y lanza `InvoiceWithReturnsError` si hay alguna.
Se pregunta por línea de pedido y no por factura porque la devolución cita el despacho (§3.3), no la
factura, y una factura emitida antes de despachar no tiene despacho propio. El puerto vive en el dominio de ventas y lo implementa el
adaptador que ya lee las devoluciones; **ventas no aprende de devoluciones**, sólo pregunta.

### 3.7 La devolución de compra puede dejar existencia negativa: no se permite

**Decisión:** devolver al proveedor más de lo que hay en la bodega se rechaza con el error de
existencia insuficiente que ya existe.

**Por qué.** La referencia lo permite si la bodega lo admite, y para protegerse tiene que hacer
malabares al ponderar el promedio siguiente. Nosotros no tenemos el concepto de bodega que admite
negativo, y **no lo vamos a introducir aquí**: sería una decisión de inventario metida de
contrabando en un hito de ventas.

### 3.8 El costo promedio del maestro se refresca siempre

**Decisión:** cualquier movimiento que cambie la existencia refresca lo que haya que refrescar, sin
excepciones por tipo de documento.

**Por qué.** Tercer defecto encontrado en la referencia: tras una devolución de compra, el costo
promedio consolidado del maestro de artículos **no se refresca** y queda desactualizado hasta la
siguiente entrada o ajuste. Es del tipo de defecto que este proyecto ya persiguió en Existencias:
el mismo número calculado en dos sitios que se separan.

**Al construir hay que comprobarlo explícitamente**, no darlo por hecho: una prueba que devuelva y
después consulte la valuación.

### 3.9 Compras y ventas son simétricas

**Decisión:** compras y ventas se construyen con la misma estructura, los mismos estados y las
mismas reglas, salvo donde el negocio obligue a diferir.

**Por qué.** Las asimetrías de la referencia no son decisiones: son el resultado de haber
construido un lado primero y no haber vuelto al otro. Se nota en que el razonamiento está escrito
en un lado y ausente en el otro.

### 3.10 Lo que sobra de una nota queda como crédito, y se gasta desde Cobros

**Decisión, tomada con Rafael el 22-sep-2026:**

- **Al confirmarse, la nota sólo abona la factura que cita**, hasta lo que esa factura todavía debe.
  Una nota sin factura —un descuento global— no abona nada al emitirse.
- **Lo que no abona queda como crédito disponible de la nota.** Con números: factura de 100 ya
  cobrada 60 y nota de 100. La nota abona 40 y le quedan 60 de crédito.
- **Ese crédito se gasta desde la pantalla de Cobros que ya existe**, con forma `credit_note` y la
  nota como origen: quien cobra elige las facturas del cliente y reparte, cada una hasta su saldo,
  como en cualquier cobro. Es el mismo cobro sin dinero de §3.2, nacido en otro momento.
- **El crédito disponible se calcula, no se guarda**: total de la nota menos lo repartido por sus
  cobros confirmados. Es la misma regla que el saldo de las facturas (§3.2): un número guardado al
  lado de la fórmula que lo produce acaba separándose de ella.
- **Devolver ese crédito en dinero no entra en H8.** Se anota en `FUTURE.md`, junto a los anticipos,
  que se construirán con este mismo mecanismo.

**Por qué así.** Es como lo resuelve la referencia (`SalesCreditNoteApplicationService` y
`ClientCollectionCreditSourceService`), y es lo que menos construye: el cobro de H6 ya reparte, ya
topa cada factura en su saldo y ya sabe anularse. Lo único nuevo es que un cobro con `credit_note`
compruebe de dónde sale su crédito. **Y no toca ninguna regla de H6**: el cobro sigue sin poder
existir sin repartos (`EmptyPaymentError`), porque el crédito no vive en un cobro, vive en la nota.

**Lo que nos separamos de la referencia:** ella guarda `applied_amount` y `balance` en la nota y los
reescribe en cada cobro. Nosotros los calculamos.

### 3.11 Una devolución no toca el pedido ni la orden

**Decisión, tomada con Rafael el 22-sep-2026:** devolver no cambia lo despachado de un pedido de
venta ni lo recibido de una orden de compra. La devolución es un hecho posterior, y si el cliente
quiere reposición, es un pedido nuevo.

**Por qué.** Es lo que hace la referencia —su devolución sólo apunta lo devuelto en su propia
línea de origen—, y reabrir cantidades cambiaría el estado de pedidos ya cerrados y las reglas de H4
y H5 que dependen de él.

**Dos consecuencias que hay que decir en voz alta:**

- **En ventas**, si se devuelve antes de facturar, la factura del despacho factura lo que salió, y
  lo devuelto se acredita con una nota. La factura no resta devoluciones.
- **En compras**, H9 tiene que topar lo facturable en **lo recibido menos lo devuelto** de cada
  línea de entrada (H9 §3.4): si no, se podría registrar una factura del proveedor por mercancía
  que ya se le devolvió.

---

## 4. Los submódulos, regla por regla

Los tres comparten ciclo de vida, y la `NCP` de H9 también: **borrador → confirmado → anulado**. En borrador se edita todo;
confirmado no se edita, sólo se anula; anulado no se toca.

### 4.1 Devolución de venta (`DVV`) — contexto `sales`

**Qué es.** Mercancía que el cliente devuelve y reingresa a una bodega.

**Cabecera:** cliente (obligatorio), **despacho de origen** (obligatorio, salvo en la devolución
sin origen de la regla 3), **bodega de reingreso** (obligatoria), fecha, motivo, condición (§3.5),
notas. La factura no se cita: se llega a ella por el pedido del despacho (§3.3).

**Líneas:** artículo, cantidad, **la línea de despacho que devuelve**, **costo unitario
congelado**, y el movimiento de salida del que procede ese costo, `restoresMovementId` (§3.4).
Línea de despacho y movimiento son nulos en la devolución sin origen.

**Reglas al confirmar:**

1. La fecha no es futura —regla que ya existe en todos los documentos— ni **anterior al despacho
   de origen**. El sistema ya tiene este patrón en despachos y facturas.
2. El despacho es **del mismo cliente** y está confirmado, y cada línea **no supera el cupo de
   cantidad** de su línea de despacho (§3.3), contando las devoluciones confirmadas anteriores.
3. El costo unitario **se copia del movimiento de kardex de su línea de despacho**, no se captura
   ni se calcula. El despacho ya graba un movimiento por línea, con la línea en `originLineId`
   (`dispatch-confirmation.ts:21`), así que la búsqueda es directa.
   Sin despacho de origen —mercancía que se vendió antes de que existiera el sistema, por ejemplo—
   **se pide escribirlo**, igual que hace el Ajuste cuando no hay de dónde sacarlo, y la línea
   queda con `restoresMovementId` nulo.
   Esa devolución **no es una reversión de nada**: es mercancía que entra, y se comporta como una
   entrada por ajuste. Hay que tratarla como caso propio, con su prueba.
4. Si la condición es `resalable` o `damaged`, **publica en el kardex** un movimiento de entrada
   que cita al original vía `restoresMovementId`, **nunca** vía `reversalOfId` (§3.4). Si es
   `scrap`, **no publica nada**. *Corregido el 22-sep-2026: decía `reversalOfId`, que es la columna
   con unicidad; construida así, la segunda devolución parcial de una línea habría reventado.*
5. La bodega tiene que estar activa. Esta regla ya existe en Catálogo y hay que reutilizarla, no
   reescribirla.
6. **No toca el pedido** (§3.11): lo despachado sigue siendo lo despachado.

**Al anular:** revierte su propio movimiento de kardex, si lo hubo, por `reversalOfId`. Una
devolución **acreditada por una nota de crédito confirmada no se anula**: primero se anula la nota.

### 4.2 Nota de crédito a cliente (`NCC`) — contexto `receivables`

**Dónde vive, y por qué ahí.** En `receivables`, no en `sales`. Lo que hace una nota de crédito es
**bajar lo que un cliente debe**, y ese es el asunto de cuentas por cobrar. Ahí están el cobro, el
reparto y el saldo que va a usar (§3.2).

**Cabecera:** cliente (obligatorio), factura afectada (opcional), **devolución que acredita**
(opcional), fecha, motivo, notas.

**Motivos:** devolución, descuento posterior, corrección de precio, mercancía dañada, cancelación,
otro. Con el mismo tratamiento que el motivo del Ajuste: **obligatorio**, y el detalle en texto
cuando es «otro».

**Líneas:** artículo o concepto, cantidad, precio, impuesto. Los totales **se derivan de las
líneas, nunca se capturan**.

**Reglas al confirmar:**

1. Con factura de origen, el total **no supera el cupo de importe** (§3.3) contando las notas
   confirmadas anteriores.
2. Con devolución enlazada: la devolución existe, está confirmada, es **del mismo cliente**, y **no
   está ya acreditada por otra nota confirmada**. Si la nota cita además una factura, la devolución
   devuelve mercancía **del mismo pedido** que esa factura.

> **Todos los bloqueos de este hito cuentan sólo documentos confirmados, nunca anulados.** Se dice
> aquí una vez y vale para §3.3, §3.6 y esta regla. Sin ello, una nota anulada por error dejaría la
> devolución sin poder acreditarse nunca más, y una factura quedaría sin poder anularse por culpa
> de documentos que ya no existen.
3. **Si cita una factura, genera un cobro confirmado** con forma de pago `credit_note` y origen
   la nota, aplicado a esa factura **hasta lo que todavía debe**, nunca por encima. Todo dentro de
   **la misma transacción**. La nota guarda cuál es ese cobro, su cobro de emisión. Si la factura
   ya no debe nada, o la nota no cita ninguna, no genera cobro.
4. Lo que no abona queda como **crédito disponible de la nota** (§3.10), que se gasta desde
   Cobros.

> **Dos correcciones del 21-sep-2026, y las dos vienen de comprobar el código en vez de suponerlo.**
>
> **La primera:** la versión anterior repartía el cobro **por el total** de la nota.
> `receivable-invoice.ts:89` rechaza aplicar más que el saldo con `PaymentExceedsBalanceError`, así
> que una nota de 100 sobre una factura de 100 ya cobrada 60 **habría reventado**. Por eso ahora el
> reparto se topa al saldo vivo.
>
> **La segunda, peor:** la versión anterior decía que un cobro sin repartir *«ya lo soporta el
> reparto actual»*. **No lo soporta.** `customer-payment.entity.ts:215` dice
> `if (details.allocations.length === 0) throw new EmptyPaymentError();`. Afirmé una capacidad del
> código sin comprobarla, que es exactamente el patrón que este proyecto persigue en el código
> ajeno.
>
> **Consecuencia, resuelta el 22-sep-2026:** el saldo a favor no existía y había que decidir dónde
> vivía. Vive **en la nota**, como crédito disponible calculado, y se gasta con cobros normales
> desde Cobros (§3.10). La regla de H6 que rechaza un cobro sin repartos no se toca.
5. **Nunca toca el kardex.** Ni con motivo «devolución»: quien mueve mercancía es la `DVV`.

**Gastar su crédito desde Cobros.** Un cobro con forma `credit_note` exige, al confirmarse:

- `creditSourceId` apunta a una nota **confirmada** y **del mismo cliente**: un cobro no cruza
  clientes.
- Lo que reparte **no supera el crédito disponible** de la nota. Es una lectura seguida de una
  escritura, así que **se toma la nota con `FOR UPDATE`** antes de sumar sus cobros, igual que los
  órdenes de bloqueo de H4, H5 y H6, con su prueba de concurrencia en el contrato del puerto: dos
  cobros confirmados a la vez sobre la misma nota no gastan más de lo que tiene.
- Lleva **la moneda y la tasa congeladas de la nota**: el crédito vale lo que valía cuando se
  emitió.
- Un cobro con dinero no lleva `creditSourceId`, y uno con `credit_note` no puede ir sin él.

**Dónde se ve el crédito.** En la pantalla de Cobros, al elegir cliente, junto al saldo por cobrar:
*«Crédito disponible»*, la suma del de sus notas. Y en los dos estados de cuenta del cliente, la
nota muestra lo que le queda. **No reduce la exposición del control de crédito**: se cuenta cuando se
aplica, no antes.

**Al anular la nota:** anula su cobro de emisión, y con él sus repartos. Si ya se gastó parte de su
crédito desde Cobros, **se rechaza**: primero se anulan esos cobros. Explícito sobre automático: no
se anulan en cascada cobros que alguien hizo en otra pantalla.

**Y la puerta de atrás, que hay que cerrar:** el **cobro de emisión** de una nota **no se anula
desde Cuentas por cobrar**. Si se pudiera, la nota quedaría viva consumiendo cupo con su crédito
devuelto sin que nadie lo decidiera. Sólo lo anula quien anula su nota. **Los cobros que gastan
crédito desde Cobros sí se anulan como cualquier cobro**, y lo que repartieron vuelve a estar
disponible en la nota: es un reparto que se deshace, no una nota que pierde su efecto.

### 4.3 Devolución de compra (`DVC`) — contexto `purchasing`

Espejo de §4.1, con la mercancía saliendo en vez de entrando.

**Diferencias reales, no de nombre:**

- Cita **la entrada** de la que sale, que es obligatoria, y cada línea **la línea de entrada** que
  devuelve. El cupo de cantidad es por línea de entrada (§3.3), y la entrada es del mismo proveedor.
- La bodega es **de donde sale**, y tiene que tener existencia suficiente (§3.7).
- El costo se congela **del movimiento de kardex de su línea de entrada**, citado por
  `restoresMovementId`, igual que en §4.1. La entrada graba un movimiento por línea, con la línea en
  `originLineId` (`receipt-confirmation.ts:23`).
- **No hay devolución de compra sin origen.** Devolverle a un proveedor mercancía que no consta que
  entrara de él no es una devolución; si hay que sacar existencia sin documento, para eso está el
  Ajuste.
- No hay condición: la mercancía se va. El motivo sigue siendo obligatorio.
- **No toca la orden** (§3.11): lo recibido sigue siendo lo recibido.

### 4.4 Nota de crédito de proveedor (`NCP`) — en H9, contexto `payables`

Espejo de §4.2. **Y aquí hay un hueco que hay que mirar antes de construir:** nosotros no tenemos
cuentas por pagar. Hay órdenes y entradas, pero **no hay un saldo con el proveedor** equivalente al
de cuentas por cobrar.

**Consecuencia:** la `NCP` no tendría dónde restar.

**Resuelto el 21-sep-2026:** se construyen **las cuentas por pagar**, y la `NCP` se va con ellas a
[H9](H9-COMPRAS-HASTA-EL-PAGO.md) §3.10, donde ya hay saldo del que restar. **Este hito construye
las tres que sí tienen dónde apoyarse**, y esta sección se conserva sólo para dejar dicho por qué
la cuarta no está aquí.

---

## 5. El esqueleto

### 5.1 Base de datos

**Tres** tablas de cabecera y tres de líneas —la `NCP` es de H9—, **con el patrón exacto de
`Invoice` / `InvoiceLine`**:
clave primaria `id` uuid, `tenantId`, `code` de doce caracteres, moneda con sus cuatro columnas
congeladas (`currency`, `exchangeRate`, `baseCurrency`, `baseExchangeRate`), importes
`Decimal(18, 4)`, `@@unique([tenantId, id])` y las relaciones compuestas por `[tenantId, id]`.

**Qué cita cada documento**, que es lo que el patrón no dice:

| Documento | Cabecera | Línea |
|---|---|---|
| `DVV` | `dispatchId` (nulo sólo sin origen), `warehouseId`, `condition` | `dispatchLineId` y `restoresMovementId` (nulos sólo sin origen), `unitCost` |
| `NCC` | `invoiceId` (opcional), `salesReturnId` (opcional), `issuePaymentId` (su cobro de emisión, nulo si no lo tuvo) | artículo o concepto, cantidad, precio, impuesto |
| `DVC` | `receiptId` (obligatorio), `warehouseId` | `receiptLineId`, `restoresMovementId`, `unitCost` |

La nota **no** guarda lo aplicado ni lo disponible (§3.10).

**Cambios sobre tablas existentes, los tres mínimos:**

```prisma
enum PaymentMethod {
  cash
  transfer
  card
  check
  credit_note   // Un cobro que no trae dinero: lo cancela el credito de una nota.
}

model CustomerPayment {
  // De qué crédito sale un cobro sin dinero. Nulo en los cobros normales.
  creditSourceId String? @map("credit_source_id") @db.Uuid
}

model InventoryMovement {
  // reversalOfId sigue como esta, con su @@unique: anular un documento entero.
  // De que salida procede el costo de una devolucion. Sin unicidad: dos devoluciones parciales
  // citan la misma salida, y el tope lo pone el cupo de cantidad, no la base de datos.
  restoresMovementId String? @map("restores_movement_id") @db.Uuid
  restores  InventoryMovement?  @relation("Restores", fields: [restoresMovementId], references: [id], onDelete: Restrict)
  restoredBy InventoryMovement[] @relation("Restores")

  @@index([restoresMovementId])
}
```

### 5.2 Los correlativos

Una línea por contexto. El puerto ya existe y es el mismo contrato en los tres:

```ts
export type SalesCodePrefix = 'CLI' | 'PED' | 'DES' | 'FAC' | 'DVV';
export type ReceivablesCodePrefix = /* los de hoy */ | 'NCC';
export type PurchasingCodePrefix = /* los de hoy */ | 'DVC';
```

### 5.3 Dominio

Por cada documento, en su contexto:

- La **entidad** con su ciclo de vida y sus invariantes, sin NestJS ni Prisma.
- Un **servicio de dominio para el cupo**: `ReturnQuota` (cantidades, por línea de despacho o de
  entrada) y `CreditQuota` (importes, por factura). Cada uno en un solo sitio, como la política de
  administración de Acceso.
- **`NoteCredit`: el crédito disponible de una nota, en un solo sitio** (§3.10): total menos lo
  repartido por sus cobros confirmados. Lo leen el cobro que lo gasta, la pantalla de Cobros y los
  estados de cuenta, y ninguno lo recalcula por su cuenta.
- Los **errores**, con `message` y `publicMessage` sin identificadores, y **dados de alta en
  `error-categories.spec.ts`** del contexto: esa prueba compara la lista con el directorio y va a
  fallar si se olvida. Que falle es correcto.

**La pieza nueva de inventario**, y es la única de verdad difícil:

```ts
// Revertir líneas sueltas, no el documento entero. Hoy StockMovements.reverse() revierte todo.
// Cada línea cita su salida por restoresMovementId y hereda SU costo, no el promedio de hoy.
// No escribe reversalOfId: esa columna es de la anulación.
reverseLines(ledger: Ledger, lines: ReversalLine[], document: DocumentRef, now: Date): StockChanges
```

### 5.4 Aplicación

Por documento: crear borrador, editar borrador, confirmar, anular, buscar con filtros y paginar, y
ver el detalle. **Paginar desde el primer día**, con el patrón de `purchasing` y `sales`: es el
hallazgo que se repitió en cinco revisiones y no vamos a volver a pagarlo.

### 5.5 API

Rutas versionadas bajo `/api/v1/`, DTO de Zod **estrictos** —que rechacen campos de más, como
quedaron los de Acceso—, y **un permiso por documento** dado de alta en el catálogo de permisos.
El guardián deniega por defecto: una ruta sin permiso declarado se rechaza sola.

### 5.6 Interfaz

Una pantalla de listado y una de detalle por documento, con `data-testid` **puestos al escribir el
componente**, no buscados después. Los mensajes de error se traducen por código, nunca se muestra
el texto de la API.

---

## 6. Fases

Cada una cierra con `make verify` en verde y su commit.

- [ ] **0. Esquema y correlativos** — migración de las seis tablas, la columna
      `restoresMovementId` del kardex, el método de pago nuevo y los tres prefijos. Sin lógica.
- [ ] **1. Inventario: revertir líneas sueltas** — `reverseLines` con su contrato de puerto contra
      el doble **y** contra PostgreSQL. Va primero porque todo lo demás se apoya en ella.
- [ ] **2. Devolución de venta** — dominio, aplicación, API, pantallas.
- [ ] **3. Nota de crédito a cliente** — incluido el cobro de emisión topado al saldo vivo, el
      crédito disponible (`NoteCredit`), **gastarlo desde Cobros** con forma `credit_note` y su
      bloqueo (§3.10 y §4.2), y el nombre en los **dos** estados de cuenta.
- [ ] **4. Devolución de compra** — espejo de la 2.
- [ ] **5. Restringir la anulación de facturas** (§3.6).
- [ ] **6. Semillas y extremo a extremo** — datos de demostración con los tres casos que separan
      los ejes —devolución sin nota, nota sin devolución, y devolución `scrap`—, y una nota con
      crédito sobrante gastado después desde Cobros.
- [ ] **7. Revisión** — con la skill `module-review`, modo «fase ya construida».

---

## 7. Las pruebas que no pueden faltar

Más allá de lo de siempre, estas defienden las decisiones de §3 y **hay que comprobar que fallan si
se quita la regla**:

| Qué defiende | La prueba |
|---|---|
| §3.2 | Confirmar una nota baja el saldo **en los nueve cálculos**: cuentas por cobrar, las dos antigüedades, los dos estados de cuenta y el tablero dicen lo mismo |
| §3.3 | Devolver diez unidades y luego acreditar diez más de la misma línea **de diez**: lo segundo se rechaza por importe |
| §3.4 | Vender a un costo, subir el promedio con una compra cara, devolver: el reingreso vale **el costo de la venta**, no el promedio nuevo |
| §3.5 | Una devolución `scrap` no genera movimiento de kardex y **sí** puede acreditarse |
| §3.4 | **Dos devoluciones parciales** contra la misma línea: las dos se registran, y la tercera que pasa del cupo se rechaza |
| §3.4 | Anular una de esas dos devoluciones revierte **sólo su movimiento**, y la otra sigue citando la misma salida |
| §4.2 | Una nota por más de lo que la factura todavía debe **no revienta**: abona hasta el saldo y el resto queda como crédito disponible |
| §3.10 | Ese crédito se gasta desde Cobros en **otra** factura del cliente; gastar más del disponible se rechaza; y una nota sin factura no genera cobro al emitirse |
| §3.10 | Dos cobros confirmados **a la vez** sobre la misma nota no gastan más que su crédito |
| §3.10 | Anular un cobro que gastó crédito lo devuelve a la nota; anular una nota con crédito ya gastado se rechaza |
| §3.3 | Devolver más de lo que salió en una línea de despacho se rechaza, aunque la factura diga más |
| §3.3 | Una factura emitida **antes de despachar** no permite devolver nada hasta que exista su despacho |
| §3.11 | Devolver no cambia lo despachado ni lo pendiente del pedido, ni lo recibido de la orden |
| §4.2 | Un cobro nacido de una nota **no se anula** desde Cuentas por cobrar |
| §3.6 | Una factura con una devolución confirmada de alguna de sus líneas de pedido **y sin nota** tampoco se anula, también si se facturó antes de despachar |
| §3.3 y §3.6 | Los documentos **anulados no bloquean**: se puede acreditar una devolución cuya nota anterior se anuló |
| §3.7 | Devolver al proveedor más de lo que hay se rechaza |
| §4.3 | Devolver al proveedor más de lo que entró en una línea de entrada se rechaza |
| §3.8 | Tras una devolución de compra, la valuación del inventario y la pantalla de existencias **siguen coincidiendo** |

---

## 8. Riesgos

**El grande: esto abre un camino nuevo a documentos que ya existen.** El propio playbook lo avisa:
*abrir un camino alternativo obliga a repasar todas las reglas que el camino viejo daba por
hechas*, y la suite sigue verde mientras el camino nuevo se las salta. Aquí el camino nuevo toca
kardex, costo promedio, saldo del cliente y anulación de facturas.

**Mitigación concreta:** la fase 7 es una revisión con `module-review` en modo «fase ya
construida», donde **la primera fuente que hay que desconfiar es este documento**. Un «✅» describe
la intención, no el resultado.

**El segundo: nueve cálculos del saldo repartidos por dieciséis sitios.** La decisión §3.2 los
esquiva, pero **sólo mientras se respete**. Si al construir aparece la tentación de «restar directamente porque es más simple»,
ese atajo cuesta dieciséis sitios y dos implementaciones de antigüedad que mantener coincidiendo
para siempre.

---

## 9. Lo que este plan NO resuelve

- **Cuentas por pagar**, y con ellas la nota de crédito de proveedor (§4.4): son
  [H9](H9-COMPRAS-HASTA-EL-PAGO.md).
- **Notas de débito** y **anticipos**.
- **Devolver en dinero el crédito disponible de una nota** (§3.10): se gasta en facturas, no se
  reembolsa. Anotado en `FUTURE.md`.
- **La contabilidad**, que es [H10](H10-CONTABILIDAD.md). Este hito la prepara sin saberlo: el costo
  congelado de §3.4 es exactamente lo que necesita el asiento que revierte el costo de ventas.
