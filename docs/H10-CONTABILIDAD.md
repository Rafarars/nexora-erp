# H10 — Contabilidad

**Estado:** plan aprobado, sin construir · **Escrito el 20-sep-2026**

Especificación ejecutable del hito, escrita para que **otra sesión la ejecute** y esta la revise.
Se construye **después** de [H8](H8-NOTAS-DE-CREDITO-Y-DEVOLUCIONES.md), que le deja resuelta una
pieza que necesita (§2.4).

---

## 1. Por qué existe, y por qué este alcance y no otro

Un ERP sin libro mayor es una rareza: el mayor es la columna vertebral, no un módulo más. Y este
sistema **ya roza la contabilidad y se aparta**: el informe de valuación calcula exactamente la
cifra que tendría que cuadrar con la cuenta de inventario, y `RETOMAR.md` dice literalmente que la
cuenta de contrapartida «aquí no aplica porque no llevamos contabilidad».

Eso no es un hueco de alcance: es un borde donde el sistema se interrumpe a media frase.

**La referencia no ayuda aquí.** `verlumyx/erp` **no tiene contabilidad**: cuarenta y cinco módulos
y ni uno de asientos. Lo que parece contable en su código —sus `PostingService`— es contabilización
de **inventario**, no de asientos. Así que todo este plan se apoya en el sector.

### El alcance, decidido: el puente, no el producto contable

| Entra | No entra |
|---|---|
| Plan de cuentas | Cierre de ejercicio |
| Asiento con la invariante debe = haber | Estados financieros |
| Contabilización automática de las doce operaciones | Impuestos y declaraciones |
| Determinación de cuentas con precedencia | Asientos escritos a mano |
| Balanza de comprobación | Centros de costo y presupuestos |
| Asiento de reverso al anular | Conciliación bancaria |

**Por qué se corta ahí.** Lo que entra es donde vive la regla interesante —la partida doble, que es
la mejor invariante de dominio que existe en software de negocio— y lo que la hace verdadera:
que se genere sola desde las operaciones reales. Lo que queda fuera es sobre todo captura de datos
y detalle regulatorio, que multiplica el tamaño sin demostrar nada nuevo.

---

## 2. Las decisiones de diseño, con su porqué

### 2.1 Un asiento nace cuadrado o no nace

**Decisión:** la entidad `JournalEntry` **no se puede construir descuadrada**. El constructor
verifica que la suma del debe iguala la del haber y lanza si no.

**Por qué nos pasamos de estrictos respecto al sector.** Los ERP maduros validan en la aplicación
y dejan el asiento en borrador cuando no cuadra:

> El código lanza una excepción si al publicar la diferencia entre Debe y Haber no es exactamente
> 0. Cuando no cuadra, el documento se queda en estado «Borrador».

Ellos necesitan el borrador porque **un contable escribe asientos a mano**, línea a línea, y hay un
momento legítimo en que van a medias. **Nosotros no tenemos asientos a mano** (§2.2), así que todos
nacen completos, de una vez, generados por el sistema. Si no pueden existir a medias, **la
invariante puede ser absoluta**: un asiento descuadrado no llega ni a ser un objeto.

Es la misma decisión que este proyecto ya tomó con el dinero: los importes se llevan en enteros
para que la suma no dependa de la suerte.

### 2.2 No hay asientos escritos a mano

**Decisión:** todos los asientos los genera el sistema desde una operación. No hay pantalla para
teclear uno.

**Por qué.** Es lo que permite §2.1, y es honesto con el alcance: un asiento manual es la puerta
por la que entran el cierre, los ajustes contables y la conciliación —justo lo que dijimos que no
entra—. Abrirla a medias sería peor que no abrirla.

**Se anota en `FUTURE.md`** con este porqué, porque es lo primero que pedirá quien use esto de
verdad.

### 2.3 El asiento se escribe en la misma transacción que la operación

**Decisión:** confirmar una entrada, emitir una factura, confirmar un cobro o confirmar un ajuste
escriben su asiento **dentro de la misma transacción**. Si el asiento falla, la operación no ocurre.

**Por qué.** Es lo que significa inventario perpetuo:

> «Perpetual Inventory is an accounting method where the system automatically posts stock-related
> accounting entries» — [ERPNext](https://docs.erpnext.com/docs/user/manual/en/stock/accounting-of-inventory-stock/perpetual-inventory)

Si el asiento se escribiera después, o en otra transacción, los libros se separarían de la realidad
en cuanto algo fallara a medias. Y un libro que a veces cuadra no sirve.

**Cómo encaja, y aquí hay trabajo desigual.** El mapa del código encontró una asimetría que hay que
resolver antes de contabilizar nada:

| Contexto | Cómo publica hoy | Qué hace falta |
|---|---|---|
| `purchasing` | Su puerto devuelve un resultado **declarativo** `{ recibo, orden, existencia }`, donde la existencia es una *instrucción* que el adaptador ejecuta | **Un campo más**: el asiento como otra instrucción |
| `sales` | Su puerto devuelve **la entidad**; el efecto sobre el pedido se aplica mutando dentro del servicio | **Alinear con el patrón de compras**, o escribir el asiento en el adaptador |

**Recomendación: alinear ventas con compras**, y hacerlo como fase propia antes de contabilizar.
Es refactor sobre código cubierto por pruebas, que es la clase de refactor barata, y deja los
cuatro flujos con la misma forma. Escribir el asiento en el adaptador sería más rápido hoy y peor
después: pondría una regla de negocio en infraestructura, justo lo que la convención prohíbe.

### 2.4 El costo de ventas sale del kardex, no se recalcula

**Decisión:** el asiento del costo de ventas toma el costo **de los movimientos de kardex que
generó el despacho**, no del promedio del momento de facturar.

**Por qué.** Es la misma regla que H8 §3.4, por la misma razón: si el costo se recalculara, el
asiento no sería espejo de lo que salió e inyectaría margen ficticio. El kardex ya guarda
`unitCost` por movimiento y de qué línea de qué documento vino, así que el dato está.

**Por eso H10 va después de H8:** H8 deja construido el reingreso al costo congelado y la reversión
por líneas, que es exactamente lo que necesita el asiento que revierte un costo de ventas.

### 2.4.1 El costo de ventas lo contabiliza el DESPACHO, no la factura

**Decisión, corregida el 21-sep-2026:** el asiento del costo de ventas se genera al **confirmar el
despacho**, no al emitir la factura. La factura contabiliza el ingreso; el despacho, el costo.

**Por qué se cambió.** La primera versión de este documento ataba el costo a la factura y avisaba
sólo del caso «factura de sólo servicios». **El caso real es mucho peor y se comprobó en el
código:** `sales-order.entity.ts:206-209` — al facturar sin despacho, `linesToInvoice(null)`
devuelve **todas** las líneas pendientes, no sólo las de servicio; y `isInvoiceable()` (`:225-226`)
admite el estado `confirmed`, que es antes de cualquier despacho.

O sea: **se puede facturar mercancía física antes de despacharla.** Con el diseño viejo, esa
factura no generaba asiento de costo —no hay movimientos de kardex todavía— y el despacho
posterior tampoco, porque los despachos no se contabilizaban. **El costo de ventas se perdía para
siempre**, y la cuenta de Inventario sólo crecía por las compras sin bajar nunca por lo vendido.

Atar el asiento al movimiento físico es además lo que pide el inventario perpetuo: **el asiento
sigue al kardex, no al documento comercial**. Es la misma regla que H9 §3.2 aplica en compras.

**Consecuencia de la que hay que acordarse:** una factura de sólo servicios sigue sin llevar
asiento de costo, pero ahora por la razón correcta —no hubo despacho que contabilizar— y no como
una excepción escrita a mano.

### 2.5 Las cuentas se determinan por precedencia: artículo → categoría → empresa

**Decisión:** cada cuenta que un asiento necesita se resuelve subiendo niveles hasta encontrarla.
Si no hay ninguna, **la operación se rechaza** con un error que dice qué cuenta falta.

**Por qué.** Es el consenso del sector, que lo llama *determinación de cuentas*. Odoo las configura
en la categoría de producto con sobrescritura en el artículo; ERPNext busca en el artículo, sube al
grupo y termina en la empresa.

**Nos encaja sin inventar nada:** ya tenemos artículos, categorías y configuración de empresa.

**Qué se configura en la empresa** (el nivel que siempre responde), **corregido el 21-sep-2026**:

| Cuenta | La usa |
|---|---|
| Inventario | Entrada, despacho, ajuste, devoluciones, revaluación |
| Costo de ventas | Despacho y su reverso |
| Ingresos por ventas | Factura de venta y nota de crédito a cliente |
| Impuesto por pagar | Facturas y notas de crédito, de los dos lados |
| Clientes por cobrar | Factura de venta, cobro, nota de crédito a cliente |
| Proveedores por pagar | Factura de compra, pago, nota de crédito de proveedor |
| Caja y banco | Cobro y pago con dinero |
| Ajuste de inventario | Ajuste, y la pérdida de una devolución `scrap` |
| **Notas de crédito por aplicar** | Emisión de la `NCC` y su cobro sin dinero |
| **Notas de crédito de proveedor por aplicar** | Emisión de la `NCP` y su pago sin dinero |
| **Mercancía por facturar** | Entrada de mercancía, y la factura de compra que la liquida |
| **Diferencia de precio de compra** | La parte de la diferencia sobre mercancía ya vendida |

**Las cuatro últimas faltaban**, y su ausencia no era cosmética: §2.5 rechaza la operación cuando
ninguna cuenta resuelve, así que el cobro por nota de crédito —que §3.6 ya nombraba— **habría sido
imposible de registrar**.

**Y «Mercancía por facturar» es nueva por otra razón**, que §3.1 explica: sin ella, la entrada y la
factura de compra acreditan la misma deuda dos veces.

**Y por qué rechazar en vez de inventar una cuenta por omisión:** una cuenta inventada produce un
asiento que cuadra y **miente**, que es peor que no poder operar. El error público dice qué falta
configurar, sin identificadores internos.

### 2.6 Anular genera un asiento de reverso; nunca se borra ni se edita

**Decisión:** un asiento es inmutable. Anular la operación que lo originó genera **otro asiento**
que lo revierte y lo cita.

**Por qué.** Es la regla contable básica y el sector la da como razón para prohibir anular
facturas: borrar rompe la trazabilidad. Además **es el patrón que este sistema ya usa** en el
kardex, con `reversalOfId` y su invariante de que un movimiento se revierte una sola vez. Se copia
tal cual, incluida la restricción de unicidad.

### 2.7 Sin periodos contables, de momento

**Decisión:** no hay periodos abiertos y cerrados en este hito.

**Por qué.** Un periodo sólo sirve para **impedir** asientos, y lo que impide son sobre todo
asientos manuales y de ajuste, que no existen (§2.2). Sin ellos, cerrar un periodo sólo impediría
facturar con fecha vieja, que es una regla de ventas y no de contabilidad.

**Se anota en `FUTURE.md`**: el día que existan asientos manuales, el periodo es lo primero que
hace falta.

### 2.8 La moneda del asiento es la de la empresa

**Decisión:** los asientos se escriben en la moneda de la empresa, con la tasa que el documento ya
congeló.

**Por qué.** El sistema ya resolvió esto y no hay que resolverlo otra vez: cada documento guarda su
moneda y **las dos tasas congeladas**, y los reportes ya convierten con ellas. El asiento usa el
mismo camino. Llevar el mayor en dos monedas es un hito propio y se anota.

---

## 3. Los asientos, operación por operación

**Reescrita entera el 21-sep-2026.** La primera versión definía **cinco** operaciones, y se escribió
cuando H9 no existía: se dejaba fuera todo lo que H8 y H9 crean. El resultado era que la propia
premisa de H9 §1.2 —*«sin pagos a proveedores esa cuenta sólo crece»*— **la incumplía este
documento**, que no definía el asiento del pago.

Esta tabla es la especificación: lo que se construya tiene que producir exactamente esto.

### La comprobación que evita que vuelva a pasar

Antes de dar §3 por terminada, **por cada cuenta del plan se comprueba que alguna operación la
debite y alguna la acredite**. Una cuenta con una sola dirección es un hueco, sin excepción. Es la
prueba de §6 y es lo que habría detectado el defecto original.

| Cuenta | La debita | La acredita |
|---|---|---|
| Inventario | Entrada · Devolución de venta · Ajuste + · Revaluación + | Despacho · Devolución de compra · Ajuste − · Revaluación − |
| Mercancía por facturar | Factura de compra | Entrada |
| Proveedores por pagar | Pago · Nota de crédito de proveedor | Factura de compra |
| Clientes por cobrar | Factura de venta | Cobro · Nota de crédito a cliente |
| Costo de ventas | Despacho | Devolución de venta |
| Ingresos por ventas | Nota de crédito a cliente | Factura de venta |
| Impuesto por pagar | Notas de crédito a cliente · Factura de compra | Factura de venta · Nota de crédito de proveedor |
| Notas de crédito por aplicar | Cobro sin dinero | Emisión de la `NCC` |
| Notas de crédito de proveedor por aplicar | Emisión de la `NCP` | Pago sin dinero |
| Caja y banco | Cobro con dinero | Pago con dinero |
| Ajuste de inventario | Ajuste − · Pérdida por `scrap` | Ajuste + |
| Diferencia de precio de compra | Factura de compra más cara de lo ya vendido | Factura de compra más barata de lo ya vendido |

### 3.1 Confirmar una entrada de mercancía

| | Cuenta | Importe |
|---|---|---|
| Debe | Inventario | Costo de las líneas |
| Haber | **Mercancía por facturar** | El mismo |

**Cambió respecto a la primera versión**, que acreditaba directamente Proveedores por pagar. Está
mal: en ese momento **el proveedor todavía no ha facturado**, así que no hay deuda exigible, sólo
mercancía recibida pendiente de documento. Es la cuenta puente que el sector llama de recepción, y
es la que hace que §3.6 pueda reconciliar la diferencia de precio.

### 3.2 Confirmar un despacho

| | Cuenta | Importe |
|---|---|---|
| Debe | Costo de ventas | Costo de los movimientos del kardex |
| Haber | Inventario | El mismo |

**Operación nueva** (§2.4.1). El costo sigue al movimiento físico, no a la factura.

### 3.3 Emitir una factura de venta

| | Cuenta | Importe |
|---|---|---|
| Debe | Clientes por cobrar | Total |
| Haber | Ingresos por ventas | Subtotal |
| Haber | Impuesto por pagar | Impuesto |

**Sólo el ingreso.** El costo ya lo llevó el despacho.

### 3.4 Confirmar una factura de compra

| | Cuenta | Importe |
|---|---|---|
| Debe | **Mercancía por facturar** | Costo con que entró la mercancía |
| Debe | Impuesto por pagar | Impuesto de la factura |
| Debe | Diferencia de precio de compra | Si la factura es más cara y la mercancía ya se vendió |
| Haber | Proveedores por pagar | Total de la factura |

**Así cierra la cuenta puente**: la entrada la acreditó al costo de recepción y la factura la
debita por lo mismo, dejándola en cero. Lo que sobra o falta es la diferencia de precio.

**Si la mercancía sigue en bodega**, la diferencia no va a esta cuenta: la absorbe el ajuste de
revaluación de H9 §3.3, que genera su propio asiento por §3.8.

**Una factura de sólo servicios** no toca «Mercancía por facturar»: debita directamente la cuenta
de gasto del artículo o categoría de servicio, resuelta por la precedencia de §2.5.

### 3.5 Confirmar un cobro

| | Cuenta | Importe |
|---|---|---|
| Debe | Caja o banco, según la forma de pago | Importe |
| Haber | Clientes por cobrar | El mismo |

### 3.6 Confirmar un cobro sin dinero, de una nota de crédito

| | Cuenta | Importe |
|---|---|---|
| Debe | Notas de crédito por aplicar | Importe |
| Haber | Clientes por cobrar | El mismo |

**No toca caja.** Sin esta distinción una nota de crédito aparecería como dinero entrado y **el
asiento cuadraría mintiendo**.

### 3.7 Emitir una nota de crédito a cliente

| | Cuenta | Importe |
|---|---|---|
| Debe | Ingresos por ventas | Subtotal |
| Debe | Impuesto por pagar | Impuesto |
| Haber | **Notas de crédito por aplicar** | Total |

**Faltaba, y sin ella la cuenta puente sólo se debitaba y no se saldaba nunca.** Con §3.6 forma el
par: la emisión la acredita, el cobro la debita, y queda en cero cuando la nota se aplica entera.

### 3.8 Confirmar un pago a proveedor

| | Cuenta | Importe |
|---|---|---|
| Debe | Proveedores por pagar | Importe |
| Haber | Caja o banco | El mismo |

**Ésta es la que faltaba y la que H9 §1.2 exige.** Sin ella, Proveedores por pagar sólo crecía.

### 3.9 Emitir una nota de crédito de proveedor, y su pago sin dinero

Emisión:

| | Cuenta | Importe |
|---|---|---|
| Debe | **Notas de crédito de proveedor por aplicar** | Total |
| Haber | Impuesto por pagar | Impuesto |
| Haber | Inventario o la cuenta de gasto | Subtotal |

Y su aplicación, el pago sin dinero: **Debe Proveedores por pagar · Haber Notas de crédito de
proveedor por aplicar.**

### 3.10 Confirmar una devolución

**De venta**, que reingresa mercancía:

| | Cuenta | Importe |
|---|---|---|
| Debe | Inventario | Costo congelado del movimiento que revierte |
| Haber | Costo de ventas | El mismo |

Es el espejo exacto de §3.2, y por eso H8 §3.4 congela el costo: con el promedio de hoy este
asiento **no sería el reverso** del que salió.

**De compra**, que saca mercancía: el espejo de §3.1, contra Proveedores por pagar o contra la
cuenta puente según haya factura o no.

**Y la devolución `scrap`**, que no reingresa nada: **no genera asiento de inventario**, porque la
mercancía ya salió con el despacho y el kardex ya lo refleja. La nota de crédito que la acredita sí
lleva el suyo por §3.7. Ver H8 §3.5, corregido el mismo día.

### 3.11 Confirmar un ajuste de inventario

| Signo | Debe | Haber |
|---|---|---|
| Positivo | Inventario | Ajuste de inventario |
| Negativo | Ajuste de inventario | Inventario |
| Revaluación + | Inventario | **Mercancía por facturar** si nace de una factura de compra; si no, Ajuste de inventario |
| Revaluación − | Lo contrario | |

**La revaluación tiene contrapartida propia** cuando la origina una diferencia de precio (H9 §3.3):
ahí lo que se corrige es la cuenta puente, no un ajuste de existencia.

### 3.12 Anular cualquiera de las anteriores

El mismo asiento con debe y haber intercambiados, citando al original (§2.6).

## 4. El esqueleto

### 4.1 Un contexto nuevo: `accounting`

Con `domain/`, `application/` e `infrastructure/`, como los ocho que ya hay. **No importa los otros
contextos**: recibe lo que necesita por sus puertos, igual que `reporting`.

### 4.2 Base de datos

```prisma
/// Una cuenta del plan. Las de grupo agrupan y no admiten movimientos.
model Account {
  id         String      @id @db.Uuid
  tenantId   String      @map("tenant_id") @db.Uuid
  code       String      @db.VarChar(20)
  name       String      @db.VarChar(120)
  type       AccountType
  /// Sólo las hojas reciben asientos. Un asiento contra una cuenta de grupo
  /// descuadraría la balanza sin que nadie lo note.
  acceptsEntries Boolean  @map("accepts_entries")
  parentId   String?     @map("parent_id") @db.Uuid
  isActive   Boolean     @default(true) @map("is_active")

  @@unique([tenantId, code])
}

enum AccountType { asset liability equity income expense }

/// Un asiento. Nace cuadrado y no se edita: anular genera otro que lo revierte.
model JournalEntry {
  id           String   @id @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  code         String   @db.VarChar(12)
  entryDate    DateTime @map("entry_date") @db.Date
  /// De qué documento nació, para poder volver a él desde la balanza.
  originType   String   @map("origin_type") @db.VarChar(20)
  originId     String   @map("origin_id") @db.Uuid
  description  String   @db.VarChar(200)
  currency     String   @db.Char(3)
  reversalOfId String?  @map("reversal_of_id") @db.Uuid

  lines JournalEntryLine[]

  /// Igual que el kardex: un asiento se revierte una sola vez.
  @@unique([reversalOfId])
  @@unique([tenantId, id])
  @@index([tenantId, originType, originId])
}

model JournalEntryLine {
  id        String  @id @db.Uuid
  tenantId  String  @map("tenant_id") @db.Uuid
  entryId   String  @map("entry_id") @db.Uuid
  accountId String  @map("account_id") @db.Uuid
  /// Uno de los dos es cero. Nunca los dos a la vez, nunca negativos.
  debit     Decimal @db.Decimal(18, 4)
  credit    Decimal @db.Decimal(18, 4)
  label     String  @db.VarChar(200)
}
```

**Y las cuentas por omisión de la empresa**, ocho columnas nullable en la configuración que ya
existe: inventario, costo de ventas, ingresos, impuesto por pagar, clientes, proveedores, caja y
ajuste de inventario. Más dos nullable en artículo y en categoría, para la precedencia (§2.5).

### 4.3 Dominio

- `JournalEntry` con la invariante en el constructor (§2.1) y una prueba que compruebe que **no se
  puede construir descuadrado**.
- `Account` con la regla de que sólo las hojas aceptan asientos.
- `AccountResolution`: el servicio de precedencia (§2.5), **en un solo sitio**, como quedó la
  política de administración de Acceso.
- `EntryBuilders`: una función pura por operación, que recibe los datos y devuelve el asiento. Puras
  significa **probables sin base de datos**, que es donde vive el valor de este hito.

### 4.4 El puerto de contabilización

```ts
export const ACCOUNTING_POSTING = Symbol('AccountingPosting');

// Los otros contextos no conocen cuentas: entregan lo que pasó y reciben una instrucción
// que su propio adaptador escribe dentro de su transaccion.
export interface AccountingPosting {
  entryFor(tenantId: TenantId, event: AccountingEvent): Promise<JournalInstruction>;
}

// Lo que cada contexto entrega. Un evento describe QUE PASO en el idioma del negocio, nunca
// cuentas: quien las resuelve es el contexto de contabilidad (§2.5).
export type AccountingEvent =
  | { kind: 'goods-received'; documentId: string; date: ReportDate; lines: CostedLine[] }
  | { kind: 'goods-dispatched'; documentId: string; date: ReportDate; lines: CostedLine[] }
  | { kind: 'sales-invoice-issued'; documentId: string; date: ReportDate; customerId: string; subtotal: Money; tax: Money }
  | { kind: 'purchase-invoice-confirmed'; documentId: string; date: ReportDate; supplierId: string; receivedCost: Money; tax: Money; total: Money; soldDifference: Money }
  | { kind: 'payment-received'; documentId: string; date: ReportDate; method: PaymentMethod; amount: Money }
  | { kind: 'payment-made'; documentId: string; date: ReportDate; method: PaymentMethod; amount: Money }
  | { kind: 'credit-note-issued'; documentId: string; date: ReportDate; side: 'customer' | 'supplier'; subtotal: Money; tax: Money }
  | { kind: 'goods-returned'; documentId: string; date: ReportDate; side: 'customer' | 'supplier'; lines: CostedLine[] }
  | { kind: 'stock-adjusted'; documentId: string; date: ReportDate; reason: AdjustmentType; lines: CostedLine[] }
  | { kind: 'document-cancelled'; reversesEntryId: string; date: ReportDate };
```

**El tipo faltaba**, y sin él cada contexto habría inventado el suyo. La regla que lo gobierna:
**un evento dice qué pasó, nunca contra qué cuenta**. Si un contexto necesitara nombrar una cuenta,
la frontera estaría mal puesta.

**Así `purchasing` no aprende contabilidad**: sigue devolviendo instrucciones, y ahora una más.

### 4.5 La balanza de comprobación

Un informe más en `reporting`, que ya tiene la maquinaria: modelo de lectura con contrato, documento
convertible a PDF y Excel, paginación en pantalla y exportación completa, y los decimales de la
empresa viajando dentro del documento.

**Columnas:** cuenta, nombre, debe, haber, saldo. **Y el total tiene que cuadrar**: si la suma del
debe no iguala la del haber, hay un defecto. Esa comprobación es una prueba, no un adorno.

---

## 5. Fases

- [ ] **0. Alinear ventas con el patrón declarativo de compras** (§2.3). Concretamente: que
      `InvoicePosting.issue`, `DispatchPosting` y `SalesOrderPosting` dejen de devolver la entidad
      y devuelvan un resultado con sus instrucciones, como hace `ReceiptPostingResult`. El efecto
      sobre el pedido deja de aplicarse mutando dentro del servicio. **Refactor con las pruebas
      existentes como red; sin comportamiento nuevo.**
- [ ] **1. Plan de cuentas** — entidad, reglas, API y pantalla. Un maestro más, como Categorías.
- [ ] **2. El asiento** — la invariante, el reverso, y los constructores puros por operación. Todo
      sin base de datos.
- [ ] **3. Determinación de cuentas** — la precedencia y su error cuando falta una.
- [ ] **4. Contabilizar las doce operaciones** (§3) — una a una, cada una con su prueba de extremo
      a extremo que comprueba que el asiento existe, cuadra y cita su documento. **Se cierra con la
      comprobación de doble dirección por cuenta**, no antes.
- [ ] **5. Balanza de comprobación** — con la prueba de que el total cuadra.
- [ ] **5b. Asientos de apertura** — el sistema lleva nueve hitos de operaciones **sin asiento**:
      inventario en bodega, facturas por cobrar, facturas por pagar. Sin esto la balanza arranca
      describiendo una empresa que no existe. Una operación que genera el asiento de apertura por
      cada saldo vivo a una fecha de corte, y **la decisión de desde cuándo se contabiliza**.
- [ ] **6. Semillas** — plan de cuentas de ejemplo en las dos empresas de demostración y las
      cuentas por omisión configuradas.
- [ ] **7. Revisión** con `module-review`, modo «fase ya construida».

---

## 6. Las pruebas que no pueden faltar

| Qué defiende | La prueba |
|---|---|
| §3 | **Por cada cuenta del plan, alguna operación la debita y alguna la acredita.** Es la prueba que habría detectado el defecto que tuvo la primera versión de este documento |
| §2.1 | Un asiento descuadrado **no se puede construir**: lanza en el constructor |
| §2.1 | Ninguna línea tiene debe y haber a la vez, ni valores negativos |
| §2.3 | Si el asiento falla, **la operación tampoco ocurre**: se fuerza el fallo y se comprueba que la factura no existe |
| §2.4 | El costo de ventas coincide con el costo de los movimientos del despacho, **no con el promedio del día de facturar** |
| §2.4.1 | **Facturar antes de despachar**: la factura lleva sólo ingreso, y el despacho posterior lleva el costo. Entre las dos, ni se pierde ni se duplica |
| §2.4.1 | Una factura de sólo servicios lleva asiento de ingreso y **ninguno** de costo |
| §3.1 y §3.4 | Recibir y luego facturar deja **«Mercancía por facturar» en cero** |
| §3.7 y §3.6 | Emitir una nota y aplicarla entera deja **«Notas de crédito por aplicar» en cero** |
| §2.5 | Con la cuenta en el artículo gana el artículo; sin ella gana la categoría; sin ninguna, la empresa; sin nada, **se rechaza la operación** |
| §2.6 | Anular genera un reverso y el original **sigue ahí**; no se puede revertir dos veces |
| §3.3 | Un cobro con forma `credit_note` **no toca caja** |
| §4.5 | La balanza cuadra después de una tanda de operaciones de todos los tipos |

---

## 7. Riesgos

**El grande: esto toca los cuatro contextos de operación a la vez.** Hoy el sistema está cerrado y
en verde; contabilizar significa que cada operación existente gana un efecto secundario que debe
ocurrir con ella o no ocurrir. Es, con diferencia, el hito con mayor superficie de contacto del
proyecto.

**Mitigación:** la fase 0 separa el refactor del comportamiento nuevo, y la fase 4 contabiliza **una
operación por vez**, cada una con su prueba, en vez de encender las doce a la vez.

**El segundo: la tentación del asiento «casi cuadrado».** Los redondeos de moneda producen
diferencias de céntimos cuando se convierte línea por línea. Este proyecto ya tiene la respuesta
—importes en enteros, redondeo en un solo sitio, decimales de la empresa viajando con el
documento— y hay que usarla, no reinventarla. **Si un asiento no cuadra por un céntimo, el defecto
está en el redondeo, no en la invariante.**

---

## 8. Lo que este plan NO resuelve

Cierre de ejercicio, estados financieros, impuestos y declaraciones, asientos manuales, periodos
contables, centros de costo, conciliación bancaria y mayor en dos monedas. Cada uno con su porqué
en `FUTURE.md`.

**Y lo que hay que decir en el README el día que esto exista:** que el sistema lleva partida doble
generada desde sus operaciones y una balanza que cuadra, **y que no es un sistema contable
completo**. Dicho por nosotros es alcance; descubierto por quien lo revisa, es un hueco.
