# Cuentas por cobrar

**Cuánto debe** cada cliente, **desde cuándo**, **qué se le cobró** y **cuánto crédito le queda**.

Contexto: `apps/api/src/contexts/receivables` · Pantallas: `/cuentas-por-cobrar/*` · Informe técnico:
[`../H6-CUENTAS-POR-COBRAR.md`](../H6-CUENTAS-POR-COBRAR.md)

| Submódulo | Tabla | Prefijo | Qué es |
|---|---|---|---|
| Cobros | `customer_payments`, `payment_allocations` | `COB` | Dinero recibido de un cliente, repartido entre sus facturas |
| Facturas por cobrar | — (se calcula) | — | Lo que debe cada factura emitida y si está vencida |
| Antigüedad de saldos | — (se calcula) | — | Lo que debe cada cliente, repartido por cuánto lleva vencido |
| Estado de cuenta | — (se calcula) | — | Facturas y cobros de un cliente por fecha, con el saldo tras cada uno |
| Límite de crédito | `customers.credit_limit` | — | Cuánto se le puede fiar a un cliente. Es un dato del cliente (Ventas) |

**Depende de Ventas**: lee sus clientes y facturas por un puerto propio (`ReceivablesLedger`), sin
importar su código. **Ventas depende de Cuentas por cobrar** en dos momentos, por un contrato
publicado (`RECEIVABLE_BALANCES`): al **emitir una factura a crédito** pregunta cuánto debe el cliente
y si tiene vencidas, y al **anular una factura** pregunta si tiene cobros.

---

## Principios

1. **El saldo no se guarda: se calcula.** Lo que debe una factura es su total menos lo que le aplican
   los cobros **confirmados**. Así nunca queda un saldo desincronizado de sus cobros.
2. **Un borrador no cuenta.** Solo un cobro confirmado baja un saldo; anularlo lo devuelve.
3. **Nunca se cobra de más.** Un cobro no aplica a una factura más de lo que debe, tampoco si dos
   cobros se confirman a la vez.
4. **Con vencidas no se fía.** A un cliente con alguna factura vencida no se le emite otra a crédito.
5. **Nada se borra.** Un cobro se anula, y una factura con cobros no se anula hasta anularlos.

---

## 1. Cobros — `customer_payments`

### 1.1 Datos

| Campo | Regla |
|---|---|
| `code` | `COB000001`, lo asigna el sistema |
| `customer_id` | Cliente de la empresa. **Puede estar inactivo**: desactivar a un cliente no le perdona la deuda |
| `payment_date` | Por defecto hoy; **no futura** y **no anterior a las facturas que paga** |
| `method` | Efectivo, transferencia, tarjeta o cheque |
| `reference` | Opcional, hasta 100 caracteres (número de transferencia, de cheque…) |
| `notes` | Opcional, hasta 500 |
| Aplicación: `invoice_id`, `amount` | Una factura **emitida, del mismo cliente**, una sola vez por cobro; monto **mayor que cero, con céntimos** |
| `currency`, `exchange_rate`, `base_*`, `manual_exchange_rate` | La moneda en que paga el cliente (por defecto, la de la empresa) y sus tasas **del día del cobro** |
| Aplicación: `exchange_rate` | La tasa **del día del cobro** para la moneda de la factura |
| Aplicación: `exchange_difference` | El diferencial cambiario en bolívares (§1.5). Nulo si la factura es anterior al multimoneda |
| `amount` | **La suma de lo aplicado, convertida a la moneda del cobro**. No se escribe a mano |
| `amount_ves` | Lo mismo en bolívares |

**Por qué el importe es la suma de lo aplicado:** así un cobro nunca tiene dinero «suelto» que no
se sabe a qué factura va. Recibir dinero sin factura (un anticipo) queda para más adelante
([FUTURE.md](../FUTURE.md)).

**Ejemplo:** Delta paga una transferencia de 150. Se aplican 100 a `FAC000007` y 50 a `FAC000009`.
El cobro vale 150; las dos facturas bajan en cuanto se confirme.

### 1.2 Ciclo de vida

```
 borrador ──confirmar──▶ confirmado ──anular──▶ anulado
    └──────────────anular──────────────────────▲
```

| Estado | Qué hace con los saldos | Qué se puede hacer |
|---|---|---|
| **Borrador** | Nada | Editar, confirmar, anular |
| **Confirmado** | Baja el saldo de cada factura en lo que le aplica | Anular |
| **Anulado** | Nada (si estaba confirmado, **devuelve** el saldo) | Nada |

**Por qué hay borrador:** quien registra el cobro puede no ser quien lo verifica en el banco. El
borrador deja anotado lo recibido sin tocar lo que debe el cliente hasta que alguien lo confirma.

### 1.3 Confirmar

Con el cobro bloqueado y **después sus facturas, en orden fijo**, se comprueba otra vez cada factura:

1. Sigue **emitida** (si ventas la anuló mientras el cobro era borrador, se rechaza).
2. Es **del cliente** del cobro.
3. La fecha del cobro **no es anterior** a la de la factura.
4. Lo que se aplica **no supera lo que debe**, contando lo que ya le cobraron **los demás** cobros.

Si una falla, no se confirma nada.

**Ejemplo de concurrencia:** una factura de 100 tiene dos borradores de 70. Dos personas confirman
a la vez. El segundo espera a que termine el primero, ve que la factura ya solo debe 30 y se rechaza
con «El cobro aplica a una factura más de lo que debe». La factura queda en 30, nunca en −40.

Al crear o editar el borrador se hace la misma comprobación con los saldos de ese momento, para
avisar pronto. **La que cuenta es la de confirmar.**

### 1.4 Anular

Un cobro confirmado se anula y **el saldo vuelve a sus facturas**. Es la forma de corregir un cobro
mal registrado: nada se edita después de confirmar.

**Consecuencia que hay que saber explicar:** si la factura ya estaba vencida, al anular su cobro
**vuelve a estar vencida** y el cliente **vuelve a quedar bloqueado** para facturar a crédito.

Ejemplo: `FAC000003` vencía el 10. El cliente pagó el 12 y se le pudo facturar a crédito el 15. El
20 se descubre que la transferencia fue rechazada y se anula el cobro: desde ese momento, la
siguiente factura a crédito se rechaza hasta que pague.

### 1.5 Cobrar en otra moneda y el diferencial cambiario

Lo aplicado se escribe **en la moneda de la factura**, que es lo que baja de su saldo. El cobro puede
estar en otra: una factura de 100 $ se paga en bolívares a la tasa del día.

- **Todo pasa por el bolívar**: lo aplicado vale `monto × tasa del cobro de la moneda de la factura`
  bolívares, y eso se divide entre la tasa de la moneda del cobro.
- **Diferencial (Bs) = monto × (tasa del cobro − tasa de la factura).** Se guarda por aplicación y
  se muestra en el cobro y en el estado de cuenta. No genera asientos: la contabilidad no existe aún.
- Sin tasa del día para alguna moneda, el cobro no se guarda (`MissingExchangeRateError`, 409).

**Ejemplo:** `FAC` de 100 $ emitida el 10 de septiembre a 152,40. El 17 (153,10) el cliente abona
40 $ en bolívares: el cobro vale **6124,00 Bs**, la factura queda debiendo **60 $** y el
diferencial es 40 × 0,70 = **28,00 Bs**.

---

## 2. Facturas por cobrar

Para cada factura **emitida** (las anuladas no se cobran y no aparecen):

| Dato | Cómo se obtiene |
|---|---|
| Cobrado | Suma de lo aplicado por cobros **confirmados** |
| Saldo | Total − cobrado, **en la moneda de la factura**; también en la de la empresa con las tasas de la factura |
| Estado | **Pendiente** (nada cobrado), **Cobrada en parte**, **Cobrada** (saldo cero) |
| Días vencida | Si tiene saldo: días desde el **día siguiente** al vencimiento. El día del vencimiento todavía está al día |

**Ejemplo:** `FAC000001` de 69,60 vence el 22-09-2026. Delta pagó 30.

| Día | Saldo | Estado | Días vencida |
|---|---|---|---|
| 21-09 | 39,60 | Cobrada en parte | 0 (al día) |
| 22-09 | 39,60 | Cobrada en parte | 0 (vence hoy) |
| 23-09 | 39,60 | Cobrada en parte | 1 |
| 23-09, tras cobrar 39,60 | 0,00 | Cobrada | 0 (ya no debe) |

El filtro por cliente (`?customerId=`) con un cliente de otra empresa responde **404**, igual que
todo lo ajeno.

---

## 3. Límite de crédito y facturas a crédito

### 3.1 El dato

`customers.credit_limit` es un monto con céntimos, **cero o más**, o **vacío = sin límite**. Se edita
en **Ventas → Clientes** junto al plazo de pago.

| Plazo | Límite | Qué significa |
|---|---|---|
| 0 (contado) | cualquiera | Se cobra al emitir: **no se vigila crédito** |
| 15 días | vacío | Se le fía sin tope, pero **no con vencidas** |
| 15 días | 1000 | Se le fía hasta deber 1000 |
| 15 días | 0 | Tiene plazo pero **no se le fía nada**: toda factura a crédito se rechaza |

### 3.2 La regla al emitir

Solo si el cliente tiene **plazo mayor que cero** (factura a crédito), al emitir:

1. Si tiene **alguna factura vencida con saldo** → `CustomerWithOverdueInvoicesError` (409):
   «El cliente tiene facturas vencidas: no se le puede facturar a crédito hasta que pague».
2. Si tiene límite y **lo que debe + el total de la nueva factura > límite** →
   `CreditLimitExceededError` (409): «La factura supera el límite de crédito del cliente».
   Llegar **justo al límite** se permite.

Lo que debe cuenta **todas sus facturas emitidas con saldo**, vencidas o no. Los cobros en borrador
no cuentan.

**Ejemplo:** Delta tiene límite 1000 y debe 900. Una factura de 100 pasa (queda en 1000); una de
100,01 se rechaza. Si paga 300, vuelve a caberle hasta 400.

**Por qué no se frena la factura de contado:** se cobra en el momento; no agrega deuda que haya que
vigilar. **Por qué se frena al facturar y no al pedir:** la deuda nace con la factura, y entre pedido
y factura el cliente puede pagar. Avisar ya en el pedido queda en [FUTURE.md](../FUTURE.md).

**Por qué no hay carrera:** al emitir se bloquea la fila del cliente. Dos facturas a crédito del
mismo cliente van en fila y la segunda ve la deuda con la primera. Probado con dos facturas de 40
sobre un cliente que debe 100 con límite 150: pasa una.

### 3.3 Bajar el límite o el plazo

Cambiar el límite **no toca facturas ya emitidas**: afecta a la siguiente. Por eso el crédito
disponible **puede verse negativo** (debe 900 y se le bajó el límite a 500: disponible −400). Hasta
que pague, no se le factura a crédito.

### 3.4 Anular una factura con cobros

Una factura con cobros confirmados **no se anula**: `InvoiceWithPaymentsError` (409) «La factura tiene
cobros aplicados: anula primero esos cobros». Si se pudiera, el dinero quedaría aplicado a una
factura que ya no existe. Los cobros en borrador no lo impiden (al confirmarlos se rechazarán).

---

## 4. Antigüedad de saldos

Por cada cliente **que debe algo**, su saldo repartido por tramos:

| Tramo | Qué entra |
|---|---|
| Por vencer | Facturas con saldo que no han vencido (incluye las que vencen hoy) |
| 1 a 30 días | Vencidas hace 1 a 30 días |
| 31 a 60 días | Vencidas hace 31 a 60 |
| 61 a 90 días | Vencidas hace 61 a 90 |
| Más de 90 días | Vencidas hace más de 90 |

Además: **plazo, límite, crédito disponible** (límite − saldo, o «sin límite»), **vencido** y si está
**bloqueado por vencidas**. Al pie, el total de cada tramo para toda la empresa.

**Ejemplo (hoy 01-03-2026):** Delta debe 50 de una factura que venció el 10-01 (50 días) y 100 de una
que venció el 20-01 (40 días). Las dos van a **31 a 60 días**: 150. Bloqueado por vencidas.

Los días se cuentan contra la **fecha UTC del servidor**, igual que «hoy» en todo el sistema.

**Saldos, tramos, límite y crédito disponible van en la moneda de la empresa**: el saldo de cada
factura se pasa a ella con las tasas de la factura, para poder sumar facturas en monedas distintas.

---

## 5. Estado de cuenta

Para un cliente: sus **facturas emitidas** (cargo, en su fecha de emisión) y sus **cobros confirmados**
(abono, en su fecha de pago), ordenados por fecha. En el mismo día van primero las facturas. Cada fila
muestra el saldo que queda.

**Garantía que protege una prueba:** el último saldo del estado de cuenta es **igual** a la suma de
lo que deben sus facturas. Si no coincidiera, algo se habría cobrado dos veces o perdido.

**Ejemplo (Delta, datos de demostración):**

| Fecha | Documento | Cargo | Abono | Saldo |
|---|---|---|---|---|
| 07-09-2026 | Factura `FAC000001` | 69,60 | — | 69,60 |
| 10-09-2026 | Cobro `COB000001` | — | 30,00 | 39,60 |

Las facturas anuladas y los cobros en borrador o anulados no aparecen: no son deuda ni pago.

Los importes van en la moneda de la empresa. Cada abono muestra además su **diferencial cambiario en
bolívares** (columna «Dif. cambiaria (Bs.)»).

---

## 6. API y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Cobros | `GET/POST /api/v1/receivables/payments`, `PUT …/:paymentId` | `receivables.payments.{search,create,update}` |
| Confirmar cobro | `PUT /api/v1/receivables/payments/:paymentId/confirm` | `receivables.payments.confirm` |
| Anular cobro | `PUT /api/v1/receivables/payments/:paymentId/cancel` | `receivables.payments.cancel` |
| Facturas por cobrar | `GET /api/v1/receivables/invoices?customerId=` | `receivables.balances.search` |
| Antigüedad | `GET /api/v1/receivables/customers` | `receivables.balances.search` |
| Estado de cuenta | `GET /api/v1/receivables/customers/:customerId/statement` | `receivables.statements.search` |

Cuerpo de un cobro:

```json
{ "customerId": "…", "date": "2026-09-10", "method": "transfer", "reference": "TRF-88231",
  "allocations": [{ "invoiceId": "…", "amount": 30 }] }
```

**Errores más frecuentes**

| Código | HTTP | Cuándo |
|---|---|---|
| `PaymentExceedsBalanceError` | 409 | Aplicar a una factura más de lo que debe |
| `InvoiceNotPayableError` | 409 | La factura está anulada |
| `InvoiceOfAnotherCustomerError` | 409 | La factura es de otro cliente |
| `PaymentBeforeInvoiceError` | 409 | Cobro con fecha anterior a la factura |
| `PaymentNotEditableError` / `PaymentNotConfirmableError` | 409 | El cobro ya no está en borrador |
| `CustomerWithOverdueInvoicesError` | 409 | (Ventas) Facturar a crédito con vencidas |
| `CreditLimitExceededError` | 409 | (Ventas) La factura supera el límite |
| `InvoiceWithPaymentsError` | 409 | (Ventas) Anular una factura con cobros |
| `InvalidPaymentAmountError` | 400 | Monto cero, negativo o con fracciones de céntimo |

---

## 7. Pantallas

| Ruta | Qué muestra |
|---|---|
| `/cuentas-por-cobrar/cobros` | Cobros con cliente, forma de pago y referencia, facturas y montos, total y estado. Menú: editar, confirmar, anular. **Nuevo cobro**: se elige el cliente y aparecen sus facturas con saldo (primero las que vencen antes), con lo que deben y si están vencidas; se escribe cuánto se cobra de cada una |
| `/cuentas-por-cobrar/facturas` | Facturas emitidas por vencimiento: total, cobrado, saldo, estado y días vencida |
| `/cuentas-por-cobrar/antiguedad` | Clientes con saldo por tramos, crédito disponible y bloqueo; el nombre lleva a su estado de cuenta |
| `/cuentas-por-cobrar/estado-de-cuenta?cliente=` | Resumen (saldo, vencido, límite, disponible) y movimientos con saldo corrido |
| `/ventas/clientes` | Columna y campo **Límite de crédito** (vacío: sin límite) |

---

## 8. Datos de demostración

| Empresa | Qué hay |
|---|---|
| Acme | Comercial Delta con **límite 1000** y plazo de 15 días |
| Acme | `COB000001` confirmado: transferencia `TRF-88231` de **30** a `FAC000001` (69,60) → debe **39,60**, disponible **960,40**. Facturada a 150,25 y cobrada a 152,40: diferencial **64,50 Bs** |
| Globex | Talleres Omega con límite 500; `COB000001` confirmado de 20 y `COB000002` en borrador de 10: blancos de la matriz de aislamiento |

El rol **Consulta** ve cobros, saldos, antigüedad y estados de cuenta, pero no cobra.

---

## 9. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio | `contexts/receivables/domain/**/*.spec.ts` y `sales/domain/dispatch/dispatch.entity.spec.ts` | Saldo en céntimos, estados, días vencida, tramos, reglas del cobro; en ventas, contado sin control, vencidas, límite al céntimo, factura con cobros |
| Aplicación | `receivables-currency.spec.ts` | Cobro en la moneda de la empresa, en bolívares y en otra divisa, tasa del día del cobro, diferencial, saldos en la moneda de la empresa |
| Aplicación | `receivables-cycle.spec.ts` | Borrador que no toca saldos, **anular devuelve el saldo**, dos borradores que no caben, cliente inactivo, factura anulada en medio, estado de cuenta que cuadra con los saldos, bloqueo que vuelve al anular un cobro |
| Contrato | `receivables-ports.contract.ts` y `sales-ports.contract.ts` | Contra doble y PostgreSQL: **dos cobros simultáneos a una factura**, **dos facturas a crédito simultáneas contra el límite**, vencida que bloquea, factura con cobros que no se anula |
| API | `tests/api/receivables.api.spec.ts` | Los tres del plan por HTTP (anular revierte, vencidas no facturan a crédito, estado de cuenta cuadra), contado, límite, concurrencia, **factura en dólares cobrada en bolívares con su diferencial**, tasa escrita para la moneda de la empresa |
| Interfaz | `tests/ui/receivables.spec.ts` | Cobrar en parte y anular en pasos Dado/Cuando/Entonces, **cobrar en bolívares y ver el diferencial**, error de sobrecobro en español, facturar con vencidas desde Despachos, solo lectura |
| Aislamiento | `tests/isolation/*` | 6 ataques a cobros, saldos y estados de cuenta de Globex |
