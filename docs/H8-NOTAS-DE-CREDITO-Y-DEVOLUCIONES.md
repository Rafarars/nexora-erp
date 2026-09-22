# H8 — Notas de crédito y devoluciones

**Estado:** plan aprobado, sin construir · **Escrito el 20-sep-2026**

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
Se leyó su código, no su documentación, y de ahí salen las decisiones de §3 —incluidas **tres donde
nos separamos de él a propósito**, porque se le encontraron defectos.

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

Estas nueve decisiones son **lo que hay que respetar al construir**. Si al ejecutar alguna resulta
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

**Decisión:** confirmar una nota de crédito a cliente **crea un cobro confirmado** con forma de
pago `credit_note`, cuyo origen apunta a la nota, repartido entre las facturas que acredita. El
saldo baja por la máquina de siempre.

**Por qué, y es la decisión más importante del hito.** El mapa del código encontró que **el saldo
de una factura se calcula en nueve sitios independientes**, en tres familias que hoy coinciden por
construcción y no por compartir código:

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

**Y prepara los anticipos**: un anticipo es otro cobro sin dinero con otro origen.

### 3.3 El cupo de cantidad y el cupo de importe son distintos

**Decisión:** dos topes separados, cada uno con su guarda.

- **Cupo de cantidad**, por línea de factura: la suma de lo devuelto no puede superar lo facturado.
  Lo consumen **las devoluciones**.
- **Cupo de importe**, por factura: la suma de lo acreditado no puede superar el total. Lo consumen
  **las notas de crédito**.

**Por qué nos separamos de la referencia.** Ahí está uno de sus defectos: las dos cantidades se
cuentan con **consultas independientes que no se miran**, así que *nada impide devolver diez
unidades y acreditar otras diez de la misma línea facturada de diez*. El cupo se consume dos veces.

Sumarlos en un solo cupo sería peor: una nota que acredita una devolución se refiere **a las mismas
unidades**, y contarlas dos veces impediría lo normal. Separar los ejes resuelve los dos casos: un
descuento global gasta importe sin gastar unidades, una devolución gasta unidades, y el tope de
importe sigue cerrando el total.

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
- La devolución usa una columna nueva, `restoresMovementId`, **sin unicidad**, que dice de qué
  salida procede el costo congelado. Varias devoluciones pueden citar la misma salida.

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
> devuelve dinero al cliente sin recuperar mercancía vendible. Esa pérdida la registra la **nota de
> crédito**, con el asiento de H10 §3.7. El inventario ya estaba bien.
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
—`SalesReturnsOfInvoice`— que responde cuántas devoluciones confirmadas cita esa factura, y lanza
`InvoiceWithReturnsError` si hay alguna. El puerto vive en el dominio de ventas y lo implementa el
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

### 3.9 Los cuatro documentos son simétricos

**Decisión:** compras y ventas se construyen con la misma estructura, los mismos estados y las
mismas reglas, salvo donde el negocio obligue a diferir.

**Por qué.** Las asimetrías de la referencia no son decisiones: son el resultado de haber
construido un lado primero y no haber vuelto al otro. Se nota en que el razonamiento está escrito
en un lado y ausente en el otro.

---

## 4. Los cuatro submódulos, regla por regla

Los cuatro comparten ciclo de vida: **borrador → confirmado → anulado**. En borrador se edita todo;
confirmado no se edita, sólo se anula; anulado no se toca.

### 4.1 Devolución de venta (`DVV`) — contexto `sales`

**Qué es.** Mercancía que el cliente devuelve y reingresa a una bodega.

**Cabecera:** cliente (obligatorio), factura de origen (opcional), despacho de origen (opcional),
**bodega de reingreso** (obligatoria), fecha, motivo, condición (§3.5), notas.

**Líneas:** artículo, cantidad, **costo unitario congelado**, movimiento de kardex que revierte.

**Reglas al confirmar:**

1. La fecha no es futura —regla que ya existe en todos los documentos— ni **anterior a la factura
   de origen**, si la hay. El sistema ya tiene este patrón en despachos y facturas.
2. Cada línea con factura de origen **no supera el cupo de cantidad** de su línea (§3.3), contando
   las devoluciones confirmadas anteriores.
3. El costo unitario **se copia del movimiento de salida original**, no se captura ni se calcula.
   Sin movimiento de origen —devolución sin factura ni despacho— **se pide escribirlo**, igual que
   hace el Ajuste cuando no hay de dónde sacarlo, y la línea queda con `restoresMovementId` nulo.
   Esa devolución **no es una reversión de nada**: es mercancía que entra, y se comporta como una
   entrada por ajuste. Hay que tratarla como caso propio, con su prueba.
4. Si la condición es `resalable` o `damaged`, **publica en el kardex** un movimiento de entrada
   que cita al original vía `reversalOfId`. Si es `scrap`, **no publica nada**.
5. La bodega tiene que estar activa. Esta regla ya existe en Catálogo y hay que reutilizarla, no
   reescribirla.

**Al anular:** revierte su propio movimiento de kardex, si lo hubo. Una devolución **acreditada por
una nota de crédito confirmada no se anula**: primero se anula la nota.

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
   está ya acreditada por otra nota confirmada**.

> **Todos los bloqueos de este hito cuentan sólo documentos confirmados, nunca anulados.** Se dice
> aquí una vez y vale para §3.3, §3.6 y esta regla. Sin ello, una nota anulada por error dejaría la
> devolución sin poder acreditarse nunca más, y una factura quedaría sin poder anularse por culpa
> de documentos que ya no existen.
3. **Genera un cobro confirmado** con forma de pago `credit_note` y origen la nota, repartido
   entre las facturas que acredita **hasta el saldo vivo de cada una**, nunca por encima. Todo
   dentro de **la misma transacción**.
4. Lo que no cabe en ningún saldo —un descuento global, o una nota mayor que lo que la factura
   todavía debe— queda como **saldo a favor del cliente**.

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
> **Consecuencia para las fases:** el saldo a favor **no existe hoy** y hay que construirlo. La
> fase 3 tiene que decidir cómo: o se permite un cobro sin repartos —cambiando una regla de H6 que
> tiene su porqué— o el saldo a favor es **otra cosa** que no es un cobro, y entonces §3.2 deja de
> cubrirlo y hay que decir dónde vive. **Recomendado: lo segundo**, y que la nota conserve un
> remanente propio, porque tocar una invariante de un hito cerrado para acomodar uno nuevo es cómo
> se rompen los sistemas.
5. **Nunca toca el kardex.** Ni con motivo «devolución»: quien mueve mercancía es la `DVV`.

**Al anular:** anula su cobro, y con él los repartos. La máquina de cobros ya sabe hacerlo.

**Y la puerta de atrás, que hay que cerrar:** un cobro nacido de una nota **no se anula desde
Cuentas por cobrar**. Si se pudiera, la nota quedaría viva consumiendo cupo y sin efecto sobre el
saldo. La guarda es la misma que ya distingue el origen: un cobro con `creditSourceId` sólo lo
anula quien anula su nota.

### 4.3 Devolución de compra (`DVC`) — contexto `purchasing`

Espejo de §4.1, con la mercancía saliendo en vez de entrando.

**Diferencias reales, no de nombre:**

- La bodega es **de donde sale**, y tiene que tener existencia suficiente (§3.7).
- El costo se congela **del movimiento de entrada** que revierte.
- No hay condición: la mercancía se va. El motivo sigue siendo obligatorio.

### 4.4 Nota de crédito de proveedor (`NCP`) — contexto `purchasing`

Espejo de §4.2. **Y aquí hay un hueco que hay que mirar antes de construir:** nosotros no tenemos
cuentas por pagar. Hay órdenes y entradas, pero **no hay un saldo con el proveedor** equivalente al
de cuentas por cobrar.

**Consecuencia:** la `NCP` no tiene dónde restar. Hay dos salidas y **la decisión es de Rafael**:

- **Dejar la `NCP` fuera del hito** y construir sólo las tres que sí tienen dónde apoyarse. Es
  coherente: sin cuentas por pagar, una nota de crédito de proveedor es un documento que no afecta
  a nada.
- **Construir cuentas por pagar primero**, que es un hito propio del tamaño de Cuentas por cobrar.

**Resuelto el 21-sep-2026:** se construyen **las cuentas por pagar**, y la `NCP` se va con ellas a
[H9](H9-COMPRAS-HASTA-EL-PAGO.md) §3.10, donde ya hay saldo del que restar. Este hito construye las
tres que sí tienen dónde apoyarse.

---

## 5. El esqueleto

### 5.1 Base de datos

**Tres** tablas de cabecera y tres de líneas —la `NCP` es de H9—, **con el patrón exacto de
`Invoice` / `InvoiceLine`**:
clave primaria `id` uuid, `tenantId`, `code` de doce caracteres, moneda con sus cuatro columnas
congeladas (`currency`, `exchangeRate`, `baseCurrency`, `baseExchangeRate`), importes
`Decimal(18, 4)`, `@@unique([tenantId, id])` y las relaciones compuestas por `[tenantId, id]`.

**Cambios sobre tablas existentes, los tres mínimos:**

```prisma
enum PaymentMethod {
  cash
  transfer
  card
  check
  credit_note   // Un cobro que no trae dinero: lo cancela un saldo a favor que ya existe.
}

model CustomerPayment {
  // De qué crédito sale un cobro sin dinero. Nulo en los cobros normales.
  creditSourceId String? @map("credit_source_id") @db.Uuid
}

model InventoryMovement {
  // Ya existe reversalOfId con su @@unique. No hay que tocar nada aquí.
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
- Un **servicio de dominio para el cupo**: `ReturnQuota` (cantidades) y `CreditQuota` (importes).
  Cada uno en un solo sitio, como la política de administración de Acceso.
- Los **errores**, con `message` y `publicMessage` sin identificadores, y **dados de alta en
  `error-categories.spec.ts`** del contexto: esa prueba compara la lista con el directorio y va a
  fallar si se olvida. Que falle es correcto.

**La pieza nueva de inventario**, y es la única de verdad difícil:

```ts
// Revertir líneas sueltas, no el documento entero. Hoy StockMovements.reverse() revierte todo.
// Cada línea cita el movimiento original y hereda SU costo, no el promedio de hoy.
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

- [ ] **0. Esquema y correlativos** — migración de las ocho tablas, el método de pago nuevo y los
      tres prefijos. Sin lógica.
- [ ] **1. Inventario: revertir líneas sueltas** — `reverseLines` con su contrato de puerto contra
      el doble **y** contra PostgreSQL. Va primero porque todo lo demás se apoya en ella.
- [ ] **2. Devolución de venta** — dominio, aplicación, API, pantallas.
- [ ] **3. Nota de crédito a cliente** — incluido el cobro sin dinero, el reparto topado al saldo
      vivo, **la decisión sobre el saldo a favor** (§4.2) y el nombre en los **dos** estados de
      cuenta.
- [ ] **4. Devolución de compra** — espejo de la 2.
- [ ] **5. Restringir la anulación de facturas** (§3.6).
- [ ] **6. Semillas y extremo a extremo** — datos de demostración con los tres casos que separan
      los ejes: devolución sin nota, nota sin devolución, y devolución `scrap`.
- [ ] **7. Revisión** — con la skill `module-review`, modo «fase ya construida».

---

## 7. Las pruebas que no pueden faltar

Más allá de lo de siempre, estas defienden las decisiones de §3 y **hay que comprobar que fallan si
se quita la regla**:

| Qué defiende | La prueba |
|---|---|
| §3.2 | Confirmar una nota baja el saldo **en los nueve sitios**: cuentas por cobrar, las dos antigüedades, los dos estados de cuenta y el tablero dicen lo mismo |
| §3.3 | Devolver diez unidades y luego acreditar diez más de la misma línea **de diez**: lo segundo se rechaza por importe |
| §3.4 | Vender a un costo, subir el promedio con una compra cara, devolver: el reingreso vale **el costo de la venta**, no el promedio nuevo |
| §3.5 | Una devolución `scrap` no genera movimiento de kardex y **sí** puede acreditarse |
| §3.4 | **Dos devoluciones parciales** contra la misma línea: las dos se registran, y la tercera que pasa del cupo se rechaza |
| §4.2 | Una nota por más de lo que la factura todavía debe **no revienta**: reparte hasta el saldo y el resto queda a favor |
| §4.2 | Un cobro nacido de una nota **no se anula** desde Cuentas por cobrar |
| §3.6 | Una factura con una devolución confirmada **y sin nota** tampoco se anula |
| §3.3 y §3.6 | Los documentos **anulados no bloquean**: se puede acreditar una devolución cuya nota anterior se anuló |
| §3.6 | Una factura con una devolución confirmada no se anula |
| §3.7 | Devolver al proveedor más de lo que hay se rechaza |
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

**El segundo: nueve implementaciones del saldo.** La decisión §3.2 las esquiva, pero **sólo mientras
se respete**. Si al construir aparece la tentación de «restar directamente porque es más simple»,
ese atajo cuesta nueve sitios y dos implementaciones de antigüedad que mantener coincidiendo para
siempre.

---

## 9. Lo que este plan NO resuelve

- **Cuentas por pagar**, y con ellas la nota de crédito de proveedor (§4.4): son
  [H9](H9-COMPRAS-HASTA-EL-PAGO.md).
- **Notas de débito** y **anticipos**.
- **La contabilidad**, que es [H10](H10-CONTABILIDAD.md). Este hito la prepara sin saberlo: el costo
  congelado de §3.4 es exactamente lo que necesita el asiento que revierte el costo de ventas.
