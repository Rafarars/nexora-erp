# Revisión: Cuentas por cobrar

**Fecha:** 19-sep-2026 · **Estado:** ✅ cerrado, con una decisión esperando a Rafael · Quién debe, cuánto, desde cuándo y qué
ha pagado ([README](../README.md))

Séptima revisión con la skill `module-review`, y la tercera **en lote**: límite de crédito,
facturas por cobrar, cobros, antigüedad de saldos y estado de cuenta, en una sola pasada.

Estados: 🔴 reproducido, sin construir · 🟢 construido · ⚪️ descartado o diferido, con el porqué

---

## Índice de hallazgos

| # | Gravedad | Submódulo | Hallazgo | Estado |
|---|---|---|---|---|
| C1 | MEDIA | Estado de cuenta | Un identificador mal escrito responde **500**, no 400 | 🟢 |
| C2 | MEDIA | Los listados | No paginan | 🟢 |
| C3 | MEDIA | Límite de crédito | Un cliente **de contado** se salta el límite **y** el bloqueo por facturas vencidas | 🟡 **decisión de Rafael** |

---

## 1. Qué hace hoy el sistema

**Nada se guarda dos veces.** El saldo de una factura no existe como columna: es su total menos lo
aplicado por cobros **confirmados**, y se calcula al leer (`receivable-invoice.ts:50`). Por eso
anular un cobro devuelve el saldo solo, sin nada que deshacer: no hay un número que corregir.

Confirmar un cobro bloquea primero el cobro y después **sus facturas, ordenadas por
identificador** (`prisma-payment-posting.ts:20-28`) —orden fijo, así que dos cobros simultáneos
sobre las mismas facturas se ponen en fila en vez de trabarse—, y relee las facturas **después**
del bloqueo, excluyendo el propio cobro.

El **límite de crédito** se comprueba al emitir la factura, dentro de la transacción y con el
cliente bloqueado (`prisma-invoice-posting.ts`, `customer-credit.ts:17-25`), y va precedido de un
bloqueo aparte: **si el cliente tiene alguna factura vencida, no se le fía más**, aunque le quede
límite.

## 2. Qué debería hacer

**El sector** coincide en lo esencial: el saldo se deriva de los documentos, la antigüedad se mide
contra el **vencimiento** y no contra la emisión, y un cobro sin confirmar no reduce deuda. Las
tres están puestas.

Donde los ERP maduros van más lejos es en lo que aquí **ya está anotado como hito propio**: notas
de crédito, anticipos del cliente y retención de impuestos.

## 3. Comparar

| Regla | Sistema | Sector | Veredicto |
|---|---|---|---|
| El saldo se deriva, no se guarda | Sí | Sí | **Ya correcto** |
| Un cobro en borrador no reduce deuda | Sí | Sí | **Ya correcto**, reproducido |
| No se cobra más de lo que se debe, con la factura bloqueada | Sí | Sí | **Ya correcto**, reproducido |
| La antigüedad se mide contra el vencimiento | Sí | Sí | **Ya correcto** |
| Una factura vencida bloquea crédito nuevo | Sí | Varía | **Ya correcto** |
| El crédito se comprueba con el cliente bloqueado | Sí | — | **Mejor que lo habitual** |
| El diferencial cambiario se guarda por aplicación | Sí | Varía | **Ya correcto** |
| **Un identificador mal escrito responde 400** | **No**, 500 | Sí | **Falta** → C1 |
| **Listados paginados y con filtros** | **No** | Sí | **Falta** → C2 |
| Notas de crédito y anticipos | No | Sí | Ya decidido: hito propio |

---

## Lo que ya estaba bien, comprobado con el caso que lo habría roto

Cobranza llega **bien defendida**, y no por coincidencia: cada regla se probó con el caso que la
separaría de su gemela.

- **Un cobro en borrador no mueve nada.** Creado un cobro de 20 sin confirmar, el saldo del cliente
  y el de la factura siguen en 39,60. Al confirmarlo bajan a 19,60, exactamente 20.
- **No se cobra más de lo que se debe** (`PaymentExceedsBalanceError`), **ni la misma factura dos
  veces en un cobro** (`DuplicatePaymentInvoiceError`), **ni importes negativos o cero**
  (`InvalidPaymentAmountError`), **ni un cobro vacío** (`EmptyPaymentError`). Las cuatro
  reproducidas.
- **La antigüedad de saldos dice lo mismo en los tres sitios que la calculan** —Cuentas por cobrar,
  Reportes y el resumen del estado de cuenta—. No se dio por bueno porque coincidieran con los
  datos de la demostración: se buscó el caso que los separaría, una factura con **126 días de
  mora**, y los tres la ponen íntegra en `over90`:

  ```
  Cuentas por cobrar: {current: 0, …, over90: 39.6, total: 39.6}   vencido: 39.6
  Reportes:           {current: 0, …, over90: 39.6, total: 39.6}
  Estado de cuenta:   {current: 0, …, over90: 39.6, total: 39.6}   vencido: 39.6
  ```

  Es la pregunta que en Ventas encontró el defecto del reservado —*¿qué caso tendría que existir
  para que no coincidieran?*— aplicada aquí, y aquí la respuesta fue que no hay ninguno.

- **La base defiende lo que el dominio promete.** El `CHECK invoices_due_not_before_issue` rechazó
  un intento de poner el vencimiento antes de la emisión, incluso escribiendo directo en SQL.

---

## C1 · MEDIA · Tres rutas devolvían un error interno por una entrada inválida

**El hallazgo empezó por accidente:** un script mío mandó `undefined` como identificador por un
error al leer la respuesta. En vez de corregir el script y seguir, se comparó ese `500` con lo que
hacen las demás rutas del sistema. El error del script era mío; el `500` no.

**Barrido de las catorce rutas que aceptan un identificador**, con la misma entrada inválida:

```
500  /receivables/customers/undefined/statement          <-- error interno
500  /receivables/invoices?customerId=undefined          <-- error interno
500  /reports/inventory-valuation?warehouseId=undefined  <-- error interno
400  /inventory/stock?warehouseId=undefined              (lo correcto)
400  /purchasing/orders?supplierId=undefined
400  /sales/availability?warehouseId=undefined
400  /receivables/payments/undefined/confirm
400  /reports/customers/undefined/statement/export
404  /users/undefined · /roles/undefined · /reports/customers/undefined/statement
```

**Tres rutas de tres contextos distintos** devuelven un error interno donde las demás responden
`400`. Los registros de la API dicen por qué:

```
invalid input syntax for type uuid: "undefined"
  at PrismaReceivablesLedger.customer
  at CustomerStatementSearcher.run
```

El identificador viajaba como `string` crudo hasta la consulta. Los contextos que responden bien lo
envuelven en un objeto de valor —`ItemRef`, `SupplierId`, `CustomerId`— que valida el formato antes
de tocar la base; **`receivables` no tenía ninguno para el cliente, ni `reporting` para la bodega**.

**Por qué importa más de lo que parece.** Un `500` no distingue «te equivocaste» de «me rompí»: en
producción ensucia el registro de errores con fallos que no lo son, y esconde los que sí. Y es la
única ruta que se salta la convención del proyecto.

**Construido:** `CustomerRef` en `receivables/domain/shared/references.vo.ts` y `WarehouseRef` en
`reporting/domain/shared/references.vo.ts`, cada uno con su prueba, y las dos comprobadas quitando
la guarda para ver que fallan sin ella.

**Los `404` se dejan como están.** Un identificador mal formado que responde «no existe» es
impreciso pero no miente, y no es un fallo del servidor. Cambiarlo tocaría el módulo de Acceso
entero para ganar exactitud en un caso que nadie encuentra usando el sistema.

## C2 · MEDIA · Los listados no paginaban

```
GET /receivables/invoices  -> 200, claves ["receivables"]   (sin total/limit/offset/hasMore)
GET /receivables/payments  -> 200, claves ["payments"]
GET /receivables/customers -> 200, claves ["customers", "totals"]
```

**Aquí la paginación no era una precaución: la semilla trae 5.000 facturas y 50 clientes de
volumen**, precisamente para que esto se note.

**Construido**, con una diferencia respecto a Compras y Ventas que merece explicarse: el saldo, el
estado de cobro y el vencimiento **no son columnas** —salen de restar lo cobrado—, así que en
facturas y en saldos por cliente el corte de página se hace **sobre todo lo que el filtro deja**,
no en la base. Es el mismo patrón que «En camino» en Compras. Los cobros sí paginan en SQL.

**Y la trampa que había que evitar:** `totals` sigue sumando **todo lo que cumple el filtro**, no la
página. Si sumara las veinte filas visibles, la cifra de arriba sería falsa en cuanto hubiera una
segunda página. Hay una prueba que lo afirma: con más de una página, `totals.total` (140) es mayor
que la suma de la página (90).



## C3 · MEDIA · Un cliente de contado se salta las dos protecciones de crédito

**Reproducido:** a **Bodegón La Esquina** —plazo de pago 0, es decir contado— se le puso un límite
de crédito de **1** y se le emitió una factura de **98,60**. Pasó sin una queja.

La causa es una línea: `if (paymentTermDays === 0) return` sale **antes** de las dos comprobaciones
(`customer-credit.ts:18`). Y no se salta sólo el límite: se salta también el **bloqueo por facturas
vencidas**, que es la protección más fuerte del módulo. Un cliente de contado con diez facturas
vencidas sigue recibiendo facturas nuevas.

**Por qué no se construyó, y por qué la decisión es tuya.** Hay dos lecturas y las dos son
razonables:

- **Es correcto.** Contado significa que paga al recibir, así que no consume crédito. Forzar el
  control bloquearía la venta de mostrador, donde la factura se emite y se cobra en el mismo acto.
- **Es un defecto.** Un `creditLimit` configurado a mano es una decisión explícita de alguien, y
  aquí se ignora **en silencio**: exactamente la clase de campo que este proyecto le ha reprochado
  tres veces al sistema de referencia —uno que se captura, se valida, se muestra y no ramifica
  nada—. Y lo de las vencidas es más difícil de defender: nada tiene que ver con el plazo.

**Esto cambia lo que el negocio puede hacer**, no arregla un cálculo equivocado. Por eso se deja
decidido por ti y no por mí. Las opciones, con su coste:

| Opción | Qué cambia | Coste |
|---|---|---|
| Dejarlo | Nada | Documentar que `creditLimit` no aplica al contado, para que nadie lo configure creyendo que sí |
| Respetar el límite si está puesto | Un contado con límite lo tiene de verdad | Una línea, y una prueba |
| Aplicar siempre el bloqueo por vencidas | Un contado moroso deja de recibir facturas | Una línea, y una prueba. **Es la mitad más defendible de las dos** |

---

## Lo que se anota sin construir

**El saldo corrido y el resumen podrían no cuadrar si una factura quedara sobrepagada.** El estado
de cuenta suma **todas** las facturas emitidas en su recorrido
(`customer-statement-searcher.ts:63`), mientras el resumen **descarta las de saldo cero o negativo**
(`aging.ts:13`). Y el propio código afirma la invariante, en un comentario:

> «El último saldo coincide con la suma de lo que deben sus facturas: si no, algo se cobró dos
> veces o se perdió.»

**Se intentó romper y no se pudo**: cobrando una factura entera, el último saldo corrido y el
resumen quedan los dos en cero. Para descuadrarlos haría falta un saldo **negativo**, y
`ensureAccepts` lo impide con la factura bloqueada (`receivable-invoice.ts:89`).

Se anota, como el «facturado ≤ despachado» de Ventas, porque **la invariante hoy se sostiene por
omisión**: el día que existan notas de crédito o anticipos —los dos ya previstos como hito propio—
un saldo negativo será posible, y entonces las dos cifras se separarán.

**Las tasas del cobro se calculan fuera de la transacción** (`payment-rates.ts`, llamado desde
`payment-confirmer.ts:25-37`) y no se revalidan contra el estado bloqueado. Es el mismo patrón que
el H12 de Compras y se difiere por el mismo motivo: no produce un estado inválido —las tasas son
del día y no cambian entre la lectura y el bloqueo—, y meterlas dentro obligaría a sostener el
bloqueo durante una consulta al catálogo de tasas.

**Los tramos de antigüedad están escritos dos veces**, en `receivables/domain/aging/aging.ts` y en
`reporting/domain/aging/aging.ts`. Hoy coinciden, y se comprobó con el caso duro. Pero son dos
escrituras de la misma regla, que es exactamente la forma del defecto que esta tanda encontró en
Ventas. **No se unifican ahora** porque cruzarían dos contextos que a propósito no se importan
entre sí; lo que corresponde es un contrato publicado entre ambos, como el que Compras y el
inventario ya usan para el kardex. Anotado en [FUTURE.md](../../FUTURE.md).


---

## Lo que este paso enseñó

1. **Un error propio puede ser un hallazgo ajeno.** El `500` salió porque mi script mandó
   `undefined` por un fallo mío al leer la respuesta. Corregir el script y seguir habría sido lo
   natural; compararlo con las otras trece rutas fue lo que encontró tres defectos en tres
   contextos.

2. **Que una regla esté bien también hay que ganárselo.** Ocho de las nueve reglas que se probaron
   estaban puestas. Ninguna se dio por buena porque coincidiera con los datos de la demostración: a
   la antigüedad se le montó una factura con **126 días de mora**, y a la invariante del estado de
   cuenta se le intentó el sobrepago. Las dos aguantaron, y eso vale escribirlo: dice dónde está el
   listón y evita que la próxima revisión las vuelva a mirar.

3. **Hay hallazgos que no son míos.** El cliente de contado que se salta el crédito es una decisión
   de negocio —puede bloquear la venta de mostrador—, no un cálculo equivocado. Construirlo sin
   preguntar habría sido cambiar lo que el negocio puede hacer, y eso no es de quien revisa.

4. **Una invariante que el código afirma es una afirmación verificable.** «El último saldo coincide
   con la suma de lo que deben sus facturas» está escrito en un comentario. Se comprobó. Aguanta
   hoy, y se anotó **por qué dejará de aguantar** cuando existan notas de crédito.
