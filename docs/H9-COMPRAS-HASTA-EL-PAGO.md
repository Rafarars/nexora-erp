# H9 — Compras hasta el pago: factura, pago y saldo

**Estado:** plan aprobado, sin construir · **Escrito el 21-sep-2026**

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

El asiento de recibir mercancía es *Debe Inventario · Haber Proveedores por pagar*. Sin pagos a
proveedores, **ninguna operación debita esa cuenta**: sólo crece, nunca baja. La balanza cuadraría
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
sistema **genera un ajuste de revaluación** por la existencia que todavía queda, y deja anotada la
diferencia que corresponde a mercancía ya vendida.

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

**Dónde va la parte ya vendida, corregido el 21-sep-2026.** La versión anterior decía que la
diferencia sobre mercancía ya vendida *«queda anotada»*, y eso no significaba nada: ninguna columna
la guardaba y ningún asiento la recogía. Ahora sí tiene sitio:

- **La factura la guarda**, en una columna propia de la cabecera, `soldDifference`, con el importe
  que no pudo absorber el inventario.
- **Y tiene cuenta**: H10 §3.4 la lleva a «Diferencia de precio de compra», que es una cuenta de
  resultado. Es lo que el sector llama *price difference account*, y es lo que impide que la
  cuenta puente de recepción quede con un saldo residual.

Sin las dos piezas, la diferencia desaparecía y la contabilidad no cerraba — que es justo lo que el
sector advierte que pasa cuando se ignora.

**Lo que hay que decidir al construir, y que consta como pregunta abierta:** si el ajuste se genera
**confirmado** o **en borrador para que alguien lo apruebe**. La referencia lo deja en borrador en
su caso de importación. Borrador es más prudente —una revaluación automática cambia el valor del
activo sin que nadie mire—, y encaja con la fricción deliberada del ciclo de compras. **Recomendado:
borrador.**

### 3.4 Lo pedido ≥ lo recibido ≥ lo facturado

**Decisión:** la línea de la orden de compra gana una cantidad facturada, y la aritmética del
sector se cumple siempre.

**Por qué es barato:** ya está medio hecho. La línea de la orden ya lleva `receivedQuantity`, y
**Ventas ya hace exactamente esto**: emitir una factura actualiza la cantidad facturada de cada
línea del pedido. Es copiar un patrón propio, no inventarlo.

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

> **Pregunta abierta, que hay que decidir antes de construir la fase 2.** ¿Se rechaza facturar de
> más, o se permite y se avisa? La referencia tiene las dos respuestas a la vez, y es instructivo:
> su servicio de dominio **sí lo permite**, con este comentario —*«un proveedor factura a veces de
> más y el ERP tiene que poder reflejarlo»*— y su pantalla **lo bloquea** sin tolerancia ninguna.
> La capacidad existe en el dominio y no hay forma de llegar a ella.
>
> El argumento de su comentario es bueno: la realidad incluye proveedores que facturan de más, y un
> sistema que no puede registrarlo obliga a mentirle. El argumento contrario también: sin flujo de
> excepción, permitirlo es dejar pasar en silencio justo lo que la conciliación existe para
> detectar. **Recomendado: rechazar**, porque sin aprobación no hay a quién avisar. Pero que la
> decisión se tome, y no se herede.

### 3.10 La nota de crédito de proveedor vive aquí

**Decisión:** la `NCP` entra en este hito, no en H8.

**Por qué.** H8 la dejó fuera con este razonamiento: *sin cuentas por pagar, una nota de crédito de
proveedor es un documento que no afecta a nada*. Aquí ya hay saldo del que restar, así que la
pregunta se resuelve sola.

**Y usa el mismo mecanismo que su hermana de ventas** (H8 §3.2): confirmar una `NCP` genera **un
pago sin dinero** con forma `credit_note`. Así la máquina de saldo, antigüedad y estado de cuenta no
se entera de que existe un documento nuevo.

---

## 4. Los submódulos, regla por regla

### 4.1 Factura de compra (`FCP`)

**Cabecera:** proveedor (obligatorio), **número y serie del proveedor** (obligatorio el número),
fecha de la factura, fecha de vencimiento, moneda con sus tasas congeladas, notas. Y los importes:
subtotal, descuento global, impuesto, flete, otros cargos, total.

**Líneas:** artículo o concepto, cantidad, precio unitario, impuesto, y **la línea de entrada que
factura** (opcional: sin ella es un servicio o un gasto).

**Reglas al confirmar:**

1. **No existe ya** una factura de ese proveedor con ese número (§3.1).
2. La fecha no es futura, y el vencimiento no es anterior a la fecha de la factura. Las dos reglas
   ya existen en Ventas y se reutilizan.
3. Cada línea con entrada de origen: la cantidad facturada **no supera la recibida**, contando las
   facturas confirmadas anteriores (§3.4). Es una lectura seguida de una escritura, así que
   **necesita su orden de bloqueo**, como lo tienen H4, H5 y H6: factura → líneas de entrada →
   líneas de orden, tomadas con `FOR UPDATE` dentro de la misma transacción. Sin él, dos facturas
   confirmadas a la vez sobre las mismas líneas pasan las dos la comprobación y **suman por encima
   de lo recibido**. Lleva prueba de concurrencia en el contrato del puerto, que es donde este
   proyecto ya demostró que esas pruebas son deterministas.
4. Todas las entradas citadas son **del mismo proveedor** y están confirmadas.
5. Los totales se derivan de las líneas más los cargos globales. **Nunca se capturan.**
6. Si algún precio difiere del costo de entrada, **genera el ajuste de revaluación** (§3.3).
7. **No toca el inventario** por ninguna otra vía (§3.2).

**Al anular:** devuelve la cantidad facturada a las líneas de la orden, y **trata el ajuste de
revaluación según su estado**: si está en borrador lo descarta, si está confirmado lo revierte, y
si ya estaba anulado no hace nada. Sin esa distinción, revertir uno ya anulado choca con la
unicidad del reverso que el kardex hereda, y un borrador huérfano se queda esperando a alguien.
Una factura con pagos confirmados no se anula —misma regla que Ventas—.

### 4.2 Pago a proveedor (`PAG`)

Espejo del cobro, y aquí la simetría **sí** es real: mismo ciclo, mismo reparto, misma anulación.

**Cabecera:** proveedor, fecha, forma de pago, referencia, importe, moneda con sus tasas.

**Reparto:** entre varias facturas del mismo proveedor, como el cobro. El sector lo confirma: *un
solo comprobante se reparte para liquidar parcial o totalmente varias facturas*.

**Una idea de la referencia que vale la pena copiar:** su reparto es único por factura y documento
—un pago abona una factura **una sola vez**—, así que corregir el importe **reescribe esa fila** en
vez de añadir otra, y una fila revertida se queda marcada en su sitio en lugar de borrarse. Eso
deja el historial legible: se ve qué se abonó, qué se corrigió y qué se revirtió.

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

Las reglas de H8 §4.2, con proveedor en vez de cliente y pago en vez de cobro. Y el cupo de
importe contra la factura de compra (H8 §3.3).

---

## 5. El esqueleto

### 5.1 Dónde vive cada cosa

**Decisión: un contexto nuevo, `payables`**, espejo de `receivables`. La factura de compra vive en
`purchasing` —es el documento del ciclo de compra, como la factura de venta vive en `sales`— y el
pago, el saldo y la antigüedad viven en `payables`.

Es la misma repartición que ya funciona del otro lado, y la convención dice **explícito sobre
automático**: dos contextos con la misma frontera que sus espejos se entienden solos.

### 5.2 Base de datos

Cuatro tablas de cabecera y tres de líneas, con el patrón exacto de `Invoice` / `InvoiceLine`:
`id` uuid, `tenantId`, `code`, moneda con sus cuatro columnas congeladas, importes
`Decimal(18, 4)`, `@@unique([tenantId, id])` y relaciones compuestas por `[tenantId, id]`.

```prisma
model PurchaseInvoice {
  // Quien identifica esta factura NO es nuestro code: es el numero que le puso el proveedor.
  supplierInvoiceNumber String  @map("supplier_invoice_number") @db.VarChar(60)
  supplierInvoiceSeries String? @map("supplier_invoice_series") @db.VarChar(20)

  // Registrar dos veces la misma factura es la forma mas comun de pagar dos veces.
  @@unique([tenantId, supplierId, supplierInvoiceNumber])
}

model PurchaseInvoiceLine {
  // Que linea de que entrada factura. Nula en servicios y gastos, que no pasan por bodega.
  receiptLineId String? @map("receipt_line_id") @db.Uuid
}

model PurchaseInvoice {
  // La parte de la diferencia de precio que el inventario no pudo absorber porque la mercancia ya
  // se vendio. Va a resultado del periodo por H10 3.4; sin esta columna no tenia donde quedarse.
  soldDifference Decimal @default(0) @map("sold_difference") @db.Decimal(18, 4)
}

model PurchaseOrderLine {
  // Espejo de invoicedQuantity en la linea del pedido de venta.
  invoicedQuantity Decimal @default(0) @map("invoiced_quantity") @db.Decimal(18, 4)
}
```

Más `SupplierPayment` y `SupplierPaymentAllocation`, calcados de `CustomerPayment` y
`PaymentAllocation`, con `credit_note` en su enum de formas de pago y la columna de origen.

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
- `PriceVariance`: reparte la diferencia entre lo que sigue en bodega y lo ya vendido (§3.3).
- Los errores, con `publicMessage` sin identificadores y **dados de alta en el
  `error-categories.spec.ts`** de su contexto.

### 5.4 Los correlativos

Una línea por contexto, como en H8:

```ts
export type PurchasingCodePrefix = /* los de hoy */ | 'FCP' | 'DVC';
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
- [ ] **3. La diferencia de precio** — el ajuste de revaluación y el reparto de lo ya vendido
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
| §3.3 | El mismo caso con la mercancía **ya vendida**: no hay revaluación, y la diferencia queda anotada |
| §3.4 | Facturar más cantidad de la recibida se rechaza |
| §3.5 | Una factura cubre dos entradas; y una entrada se factura en dos facturas. **Los dos casos** |
| §3.6 | Una factura de sólo servicios, sin ninguna entrada, se confirma |
| §3.8 | El saldo que dicen el listado, la antigüedad, el estado de cuenta y el tablero es **el mismo** |
| §3.1 | `FAC-001` y `fac-001` del mismo proveedor son **la misma factura**; anular una **libera** su número |
| §4.1 | Dos facturas confirmadas **a la vez** sobre las mismas líneas de entrada no suman por encima de lo recibido |
| §4.1 | Anular una factura cuyo ajuste de revaluación está **en borrador** lo descarta; si está confirmado lo revierte |
| §3.3 | La diferencia sobre mercancía ya vendida **queda en `soldDifference`** y llega al asiento de H10 §3.4 |
| §4.2 | Pagar más que el saldo se rechaza; pagar facturas de otro proveedor se rechaza |

---

## 8. Riesgos

**El grande: §3.3 es la pieza más difícil del hito**, porque toca el costo del inventario desde un
documento que por regla no lo toca (§3.2). La contradicción es aparente —quien revaloriza es el
Ajuste, no la factura— pero es fina, y quien la construya deprisa va a acabar escribiendo en el
kardex desde `purchasing`. **Por eso va en fase propia y después de que todo lo demás esté en
verde.**

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
