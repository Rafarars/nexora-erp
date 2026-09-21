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
| Contabilización automática de las cinco operaciones | Impuestos y declaraciones |
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

**Por eso H9 va después de H8:** H8 deja construido el reingreso al costo congelado y la reversión
por líneas, que es exactamente lo que necesita el asiento que revierte un costo de ventas.

**Ojo con la factura sin despacho.** Una factura de sólo servicios no tiene movimientos de kardex y
por tanto **no lleva asiento de costo de ventas**, sólo el de ingreso. Tiene que tener prueba
propia: es el caso que un generador ingenuo rompe.

### 2.5 Las cuentas se determinan por precedencia: artículo → categoría → empresa

**Decisión:** cada cuenta que un asiento necesita se resuelve subiendo niveles hasta encontrarla.
Si no hay ninguna, **la operación se rechaza** con un error que dice qué cuenta falta.

**Por qué.** Es el consenso del sector, que lo llama *determinación de cuentas*. Odoo las configura
en la categoría de producto con sobrescritura en el artículo; ERPNext busca en el artículo, sube al
grupo y termina en la empresa.

**Nos encaja sin inventar nada:** ya tenemos artículos, categorías y configuración de empresa.

**Qué se configura en la empresa** (el nivel que siempre responde): inventario, costo de ventas,
ingresos por ventas, impuesto por pagar, clientes por cobrar, proveedores por pagar, caja y banco,
y ajuste de inventario.

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

Los cinco casos, tal como los define el sector. **Esta tabla es la especificación**: lo que se
construya tiene que producir exactamente esto.

### 3.1 Confirmar una entrada de mercancía

| | Cuenta | Importe |
|---|---|---|
| Debe | Inventario | Costo de las líneas |
| Haber | Proveedores por pagar | El mismo |

### 3.2 Emitir una factura de venta

Dos asientos, y son independientes: el de ingreso siempre, el de costo sólo si hubo despacho (§2.4).

**Ingreso:**

| | Cuenta | Importe |
|---|---|---|
| Debe | Clientes por cobrar | Total |
| Haber | Ingresos por ventas | Subtotal |
| Haber | Impuesto por pagar | Impuesto |

**Costo de ventas:**

| | Cuenta | Importe |
|---|---|---|
| Debe | Costo de ventas | Costo de los movimientos del despacho |
| Haber | Inventario | El mismo |

### 3.3 Confirmar un cobro

| | Cuenta | Importe |
|---|---|---|
| Debe | Caja o banco, según la forma de pago | Importe |
| Haber | Clientes por cobrar | El mismo |

**El caso que H8 introduce:** un cobro con forma de pago `credit_note` **no toca caja**. Debe a
Notas de crédito por aplicar, haber a Clientes por cobrar. Sin esta distinción, una nota de crédito
aparecería como dinero entrado y **el asiento cuadraría mintiendo**. Prueba obligatoria.

### 3.4 Confirmar un ajuste de inventario

| Signo | Debe | Haber |
|---|---|---|
| Positivo | Inventario | Ajuste de inventario |
| Negativo | Ajuste de inventario | Inventario |

### 3.5 Anular cualquiera de los anteriores

El mismo asiento con debe y haber intercambiados, citando al original (§2.6).

---

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
```

**Así `purchasing` no aprende contabilidad**: sigue devolviendo instrucciones, y ahora una más.

### 4.5 La balanza de comprobación

Un informe más en `reporting`, que ya tiene la maquinaria: modelo de lectura con contrato, documento
convertible a PDF y Excel, paginación en pantalla y exportación completa, y los decimales de la
empresa viajando dentro del documento.

**Columnas:** cuenta, nombre, debe, haber, saldo. **Y el total tiene que cuadrar**: si la suma del
debe no iguala la del haber, hay un defecto. Esa comprobación es una prueba, no un adorno.

---

## 5. Fases

- [ ] **0. Alinear ventas con el patrón declarativo de compras** (§2.3). Refactor con las pruebas
      existentes de red; sin comportamiento nuevo.
- [ ] **1. Plan de cuentas** — entidad, reglas, API y pantalla. Un maestro más, como Categorías.
- [ ] **2. El asiento** — la invariante, el reverso, y los constructores puros por operación. Todo
      sin base de datos.
- [ ] **3. Determinación de cuentas** — la precedencia y su error cuando falta una.
- [ ] **4. Contabilizar las cinco operaciones** — una a una, cada una con su prueba de extremo a
      extremo que comprueba que el asiento existe, cuadra y cita su documento.
- [ ] **5. Balanza de comprobación** — con la prueba de que el total cuadra.
- [ ] **6. Semillas** — plan de cuentas de ejemplo en las dos empresas de demostración y las
      cuentas por omisión configuradas.
- [ ] **7. Revisión** con `module-review`, modo «fase ya construida».

---

## 6. Las pruebas que no pueden faltar

| Qué defiende | La prueba |
|---|---|
| §2.1 | Un asiento descuadrado **no se puede construir**: lanza en el constructor |
| §2.1 | Ninguna línea tiene debe y haber a la vez, ni valores negativos |
| §2.3 | Si el asiento falla, **la operación tampoco ocurre**: se fuerza el fallo y se comprueba que la factura no existe |
| §2.4 | El costo de ventas coincide con el costo de los movimientos del despacho, **no con el promedio del día de facturar** |
| §2.4 | Una factura de sólo servicios lleva asiento de ingreso y **ninguno** de costo |
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
operación por vez**, cada una con su prueba, en vez de encender las cinco a la vez.

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
