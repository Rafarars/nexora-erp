# Revisión: Cuentas por cobrar

**Fecha:** 19-sep-2026 · **Estado:** 🔍 auditoría en curso · Quién debe, cuánto, desde cuándo y qué
ha pagado ([README](../README.md))

Séptima revisión con la skill `module-review`, y la tercera **en lote**: límite de crédito,
facturas por cobrar, cobros, antigüedad de saldos y estado de cuenta, en una sola pasada.

Estados: 🔴 reproducido, sin construir · 🟢 construido · ⚪️ descartado o diferido, con el porqué

---

## Índice de hallazgos

| # | Gravedad | Submódulo | Hallazgo | Estado |
|---|---|---|---|---|
| C1 | MEDIA | Estado de cuenta | Un identificador mal escrito responde **500**, no 400 | 🟢 |
| C2 | MEDIA | Los listados | No paginan | 🔴 |

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

## C2 · MEDIA · Los listados no paginan

```
GET /receivables/invoices  -> 200, claves ["receivables"]   (sin total/limit/offset/hasMore)
GET /receivables/payments  -> 200, claves ["payments"]
GET /receivables/customers -> 200, claves ["customers", "totals"]
```

Mismo defecto que en Compras y Ventas. El de clientes lleva además `totals`, que debe seguir
siendo el total de **todo**, no el de la página: es la suma que la pantalla enseña arriba.
