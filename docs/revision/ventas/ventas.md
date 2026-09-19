# Revisión: Ventas

**Fecha:** 19-sep-2026 · **Estado:** ✅ cerrado · A quién se le vende, qué pidió, qué
salió del almacén y qué se le facturó ([README](../README.md))

Sexta revisión con la skill `module-review`, y la segunda **en lote**: los cinco submódulos
—Clientes, Pedidos, Disponibilidad, Despachos y Facturas— auditados en una sola pasada.

Estados: 🔴 reproducido, sin construir · 🟢 construido · ⚪️ descartado o diferido, con el porqué

---

## Índice de hallazgos

| # | Gravedad | Submódulo | Hallazgo | Estado |
|---|---|---|---|---|
| V1 | MEDIA | Los cinco | Ningún listado pagina, y `limit` y `q` se ignoran en silencio | 🟢 |
| V2 | **ALTA** | Clientes | Un cliente se desactiva con pedidos abiertos, y se le sigue despachando | 🟢 |
| V3 | **ALTA** | Pedidos y Disponibilidad | Lo reservado se calcula en tres sitios con dos criterios: la pantalla promete lo que el sistema luego rechaza | 🟢 |
| V4 | MEDIA | Despachos y Facturas | Un despacho puede fecharse antes de su pedido, y una factura antes de lo que cobra | 🟢 |
| V5 | — | Facturas | No existe la comparación «facturado ≤ despachado» | ⚪️ riesgo anotado |
| V6 | BAJA | Facturas | El correlativo se pide fuera de la transacción: un fallo deja huecos | ⚪️ diferido |

---

## Lo que ya estaba bien, comprobado antes de buscar fallos

Ventas llega a esta revisión **mejor defendido de lo que estaban Compras e Inventario** en sus
flancos equivalentes. Se reprodujo cada uno contra la API local:

- **Los servicios no se reservan.** Un pedido mixto —5 unidades de mercancía y 3 de un servicio—
  sube el reservado de 72 a **77**, y el servicio no aparece en Disponibilidad. Es justo el defecto
  que Compras sí tenía en «En camino» (H8), y aquí el filtro `movesStock` está puesto.
- **Un despacho no se factura dos veces**: `DispatchAlreadyInvoicedError`.
- **Un despacho facturado no se anula**: `DispatchInvoicedError`, «cancel its invoice first». La
  mercancía no vuelve al almacén dejando una factura viva.
- **El límite de crédito se comprueba, y en el momento correcto.** No al pedir —cuando todavía no
  se debe nada— sino **al facturar**: con el límite en 1 y una factura de 8,50, responde
  `CreditLimitExceededError`. Reproducido bajando el límite del cliente de la demostración.
- **La existencia se comprueba antes que el crédito** al confirmar un pedido: pedir 5.000 unidades
  de algo de lo que hay 288 responde `InsufficientAvailabilityError`.

## 1. Qué hace hoy el sistema

Ventas llega a esta revisión **mejor defendido que Compras e Inventario** en sus flancos
equivalentes, y la sección siguiente lo detalla. El motor está bien: el despacho baja la existencia
en una sola transacción con el pedido, la factura nace del despacho y no se duplica, y el crédito
se comprueba donde importa.

Lo que falló aquí no son cálculos sueltos, sino **una cifra que se calcula en tres sitios** y
**maestros que se cierran dejando documentos vivos** — los dos patrones que esta tanda de
revisiones ya había visto en otros módulos.

## 2. Qué debería hacer

**El sistema de referencia** (`app/Modules/{Client,SalesOrder,Dispatch,SalesInvoice}/`), leído en
su código. Le lleva ventaja en el rastro de autor (`created_by`, `approved_by`) y en poder saltarse
el límite de crédito con un permiso propio. Y repite su costumbre de declarar cosas que no
ramifican: sus **tipos de cliente** no cambian ninguna regla de venta, el `discount_percent` del
cliente **no lo lee ningún cálculo**, y la **retención se calcula por línea y nunca entra en la
cabecera**. Tres etiquetas muertas más, sobre las dos que ya se le encontraron en Inventario y
Compras.

Un detalle suyo que sí merece anotarse como aviso: al reservar, si la bodega no tiene ubicación por
defecto, **su servicio retorna sin reservar y sin avisar** (`SalesOrderReservationService`). Una
reserva que falla en silencio es peor que una que se niega.

## 3. Comparar

| Regla | Sistema | Referencia | Sector | Veredicto |
|---|---|---|---|---|
| El despacho baja la existencia en una transacción con el pedido | Sí | Por servicios encadenados | Sí | **Mejor que la referencia** |
| Un despacho no se factura dos veces | Sí, con índice único parcial | — | Sí | **Ya correcto** |
| Un despacho facturado no se anula | Sí | — | Sí | **Ya correcto** |
| El crédito se comprueba al facturar, no al pedir | Sí | Al confirmar el pedido | Varía | **Ya correcto**, decisión escrita |
| Los servicios no reservan existencia | Sí en el dominio y la pantalla | Sí | Sí | **Falta en el sitio que decide** → V3 |
| **Una cifra, un solo cálculo** | **No**: tres sitios, dos criterios | — | — | **Falta** → V3 |
| **No cerrar un maestro con documentos abiertos** | **No** (cliente) | **No** (no comprueba nada) | Sí | **Falta** → V2 |
| **Un documento no se fecha antes de su origen** | **No** | — | Sí | **Falta** → V4 |
| **Listados paginados y con filtros** | **No** | Sí | Sí | **Falta** → V1 |
| Facturado ≤ despachado | **No existe la guarda** | Sí | Sí | **Anotado** → V5 |
| Rastro de autor | No | Sí | Sí | Ya decidido: hito propio |

---

## V1 · MEDIA · Ningún listado de Ventas pagina, y los parámetros se ignoran

Mismo defecto que en Compras, en los cinco submódulos:

```
GET /sales/customers      -> 200, claves ["customers"]      (sin total/limit/offset/hasMore)
GET /sales/orders         -> 200, claves ["orders"]
GET /sales/dispatches     -> 200, claves ["dispatches"]
GET /sales/invoices       -> 200, claves ["invoices"]
GET /sales/availability   -> 200, claves ["availability"]
GET /sales/customers?limit=1 -> 200, devuelve 2 filas       (limit ignorado)
GET /sales/customers?q=xxx   -> 200, devuelve 2 filas       (q ignorado)
```

## V2 · ALTA · Un cliente se desactiva con pedidos abiertos, y se le sigue despachando

**Comercial Delta** tiene `PED000001` a medio despachar y `FAC000001` emitida. Con eso encima:

```
PUT  /sales/customers/{delta}/status {active:false}  -> 200   (nada lo impide)
POST /sales/dispatches (1 unidad de ese pedido)      -> 201   (se crea)
PUT  /sales/dispatches/{id}/confirm                  -> 200   (la mercancía SALE del almacén)
```

**Es el tercer maestro con el mismo hueco.** El Catálogo lo resolvió para las bodegas, esta misma
tanda lo resolvió para los proveedores, y el cliente sigue sin la regla. La diferencia con
Compras es que aquí la mercancía **sale**, no entra: se despacha a nombre de alguien a quien la
empresa ya decidió dejar de venderle.


## V3 · ALTA · Lo reservado se calcula en tres sitios, y no todos dicen lo mismo

**Reproducido de punta a punta:**

```
LA PANTALLA dice: hay 10 · reservado 5 · disponible 5
El pedido pide exactamente 5  ->  409 InsufficientAvailabilityError
```

La pantalla promete cinco unidades y el sistema rechaza un pedido de cinco. Quien vende mira una
cifra y el sistema decide con otra.

**Por qué.** Lo reservado se calcula en tres sitios:

| | Dónde | ¿Filtra `movesStock`? |
|---|---|---|
| A | **Producción**: `prisma-sales-order-posting.ts:35-44`, la SQL que decide si el pedido se confirma | **No** |
| B | **Doble en memoria**: `in-memory-sales-store.ts:147-152` | Sí |
| C | **Pantalla**: `availability-searcher.ts:49-56` | Sí |

A la consulta de producción le falta `AND l.moves_stock`. El dominio sí lo filtra
(`sales-order.entity.ts:195`), la pantalla también, y el doble también. **Sólo el sitio que
realmente decide, no.**

**Cómo se llega ahí:** `moves_stock` se congela en la línea al escribirla. Si un artículo pasa de
servicio a inventariado —y el sistema deja cambiarlo—, conviven líneas del mismo artículo con el
indicador en ambos valores. La consulta suma las dos; la pantalla, sólo unas.

**Y hay un segundo defecto en la misma consulta.** Su comentario dice: «El pendiente base se
redondea a cuatro decimales, **igual que en el dominio**». No es igual:

- El **dominio** redondea **cada línea** con enteros escalados y luego suma
  (`sales-order-line.ts:134-136`).
- La **consulta** suma en SQL, convierte con `Number(...)` —coma flotante— y redondea **una sola
  vez al final** (`:50`).

Es el mismo defecto de fondo que la revisión de Existencias encontró con el valor del inventario:
dos aritméticas para la misma cifra. Aquí, además, el comentario afirma que son la misma.

### Por qué ninguna prueba lo vio

**El doble filtra y la consulta no**, así que el contrato de puertos —que corre contra los dos—
pasa en verde: ambos coinciden en todos los casos que existen, porque **ninguno tiene una línea de
servicio de otro pedido** (`sales-ports.contract.ts:155-181`).

Es la tercera vez en estas revisiones que aparece el mismo patrón: **el doble se comporta mejor
que la base, y eso esconde el defecto en lugar de revelarlo**. Las dos anteriores fueron
`confirmed_by` en Ajustes y el plazo de pago en Compras, ambas por columnas enumeradas a mano.


## V4 · MEDIA · Un despacho puede fecharse antes de su pedido, y una factura antes de lo que cobra

**Reproducido, los dos:**

```
pedido PED000004 fechado el 2026-09-10
POST /sales/dispatches { date: '2026-06-01' }  -> 201, y se confirma
   la mercancía "salió" tres meses antes de que se pidiera

despacho DES000002 fechado el 2026-09-15
POST /sales/invoices  { date: '2026-07-01' }   -> 201  (FAC000002)
   la factura cobra el 1 de julio algo que salió el 15 de septiembre
```

La única guarda de fecha en los dos documentos es «no futura»
(`dispatch.entity.ts:176`, `invoice.entity.ts:110`). Nadie compara con el documento que les da
origen. Es el mismo hallazgo que H7 de Compras, y pesa por dos motivos más:

- **La fecha del despacho viaja al kardex** (`origin_date`), así que una salida se lista en junio,
  antes de que existiera el pedido que la explica.
- **La fecha de la factura fija el vencimiento**, y de ahí salen la antigüedad de saldos y el
  estado de cuenta. Una factura retrofechada nace vencida y ensucia la cobranza.

**Construido:** `DispatchBeforeOrderError` e `InvoiceBeforeOriginError`. La factura se compara con
su despacho cuando nace de uno, y con el pedido cuando se factura directo.

**Y obligó a corregir una prueba que describía algo imposible:** el contrato emitía una factura
fechada el 1 de enero sobre un despacho del 15, para simular una vencida. Ahora el pedido y el
despacho también son del 1 de enero, que es como se ve una factura vieja de verdad.

---

## Lo que NO se construyó, y por qué

**V5 · No existe la comparación «facturado ≤ despachado».** La única guarda compara contra lo
**pedido**: `pendingToInvoice = quantity − invoiced` (`sales-order-line.ts:154-159`), nunca contra
`dispatchedQuantity()`.

**Se intentó explotar y no se pudo.** Las cantidades de una factura nunca las escribe quien llama:
salen del despacho confirmado, o del pedido cuando se factura directo —y facturar directo un pedido
con mercancía lo impide `OrderNotDirectlyInvoiceableError`—. Así que hoy no hay camino para
facturar mercancía que no salió.

**Se anota igual** porque la guarda que falta es la que expresa la regla: el día que aparezca un
camino que acepte cantidades —una nota de crédito, una factura parcial, una corrección—, el sistema
no la tendrá. Es una invariante que hoy se sostiene por omisión, no por decisión.

**V6 · Los huecos en la numeración.** El correlativo se pide **fuera** de la transacción
(`invoice-issuer.ts:88` frente a `:91`): si la transacción falla, el número se pierde. Ya hay un
ensayo previo sobre una copia del pedido que reduce los huecos, pero no los cierra.

No se construyó porque **la numeración legal de las facturas es una de las decisiones que esperan a
Rafael** (`revision/temas/configuracion-empresa.md` §10.3, «serie legal en facturas»), y mover el
correlativo dentro de la transacción es justo lo que esa decisión condiciona: una serie fiscal no
se numera igual que un correlativo interno.

---

## Lo que este paso enseñó

1. **El doble que se porta mejor que la base esconde el defecto, no lo revela.** Es la tercera vez
   en estas revisiones: `confirmed_by` en Ajustes, el plazo de pago en Compras y ahora el reservado.
   Las tres veces el contrato pasaba en verde porque **los dos lados coincidían en los casos que
   existían**, y el caso que los separaba no estaba escrito. La pregunta que lo encuentra no es
   «¿pasa el contrato?» sino **«¿qué caso tendría que existir para que el doble y la base no
   coincidieran?»**.

2. **Coincidir en casi todo es lo que impide ver la diferencia.** Las tres definiciones del
   reservado coincidían en los estados, en la resta y en la unidad. Diferían en una palabra. Si
   hubieran sido distintas de arriba abajo, alguien lo habría notado años antes.

3. **Un comentario que afirma una equivalencia hay que comprobarlo.** «Se redondea a cuatro
   decimales, igual que en el dominio» describía una intención, no el código: el dominio redondea
   por línea y la consulta sumaba primero. Un comentario así es una afirmación verificable, y la
   revisión tiene que tratarla como tal.

4. **Que una regla esté bien también es un resultado.** Cinco de los flancos que en Compras e
   Inventario estaban rotos, aquí estaban puestos. Escribirlo evita que la próxima revisión los
   vuelva a mirar, y dice dónde está el listón del proyecto.

5. **No todo hueco es explotable, y hay que intentarlo antes de llamarlo hallazgo.** La guarda
   «facturado ≤ despachado» no existe, pero no hay camino para llegar a ella. Anotarla como riesgo
   —no como defecto— es lo que la hace útil el día que alguien añada notas de crédito.
