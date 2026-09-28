Busca huecos en el plan de H9 de este ERP, **antes de construirlo**. H9 cierra el ciclo de
compras hasta el dinero: factura de compra, pago a proveedor, saldo por pagar, y nota de crédito de
proveedor. El plan ya pasó dos validaciones (21 y 22-sep-2026). Lo que cambia ahora es que **H8 ya
está construido y en `main`**, y el plan se acaba de contrastar con ese código y de corregir
(28-sep-2026). Tu trabajo es encontrar lo que el plan, **tal como está escrito hoy**, deja roto o
sin resolver frente al **código que existe**.

## Qué leer

- `docs/H9-COMPRAS-HASTA-EL-PAGO.md`, entero: es lo que se valida.
- `docs/H10-CONTABILIDAD.md`, **§2.8, §3.4, §3.5, §3.8, §3.9, §3.11, §4.2 y §4.4**: se acaban de
  cambiar para acompañar a H9 (diferencia de precio pendiente y diferencia en cambio).
- El código que H9 toca o copia. Léelo, no lo supongas:
  - Compras: `apps/api/src/contexts/purchasing/` (entradas `domain/receipt/`, devoluciones de compra
    `domain/return/`, y sus `infrastructure/persistence/prisma-receipt-posting.ts` y
    `prisma-purchase-return-posting.ts` con su orden de bloqueo).
  - Inventario: `apps/api/src/contexts/inventory/domain/adjustment/` (la revaluación de hoy, en
    `posting/adjustment-confirmation.ts`) y `domain/stock/` (kardex y costo promedio).
  - Cuentas por cobrar, que H9 espeja con los proveedores:
    `apps/api/src/contexts/receivables/` (cobros, reparto, nota de crédito de H8 con su pago de
    emisión, su crédito disponible y su gasto desde Cobros).
  - El esquema: `apps/api/prisma/schema.prisma` (`GoodsReceipt`, `GoodsReceiptLine`,
    `PurchaseOrderLine`, `PurchaseReturn`, `CustomerPayment`, `PaymentAllocation`,
    `CustomerCreditNote`).
- Contexto: `docs/H8-NOTAS-DE-CREDITO-Y-DEVOLUCIONES.md` (el diseño que H9 espeja) y
  `docs/ARCHITECTURE.md`.

## Qué buscar

1. **El plan contra el código.** Toda afirmación de H9 sobre lo que ya existe («ya existe en Ventas y
   se reutiliza», «espejo del cobro», «el mismo orden de bloqueo», nombres de tablas, campos,
   prefijos, archivos): ¿es cierta en el código? Cita `archivo:línea` del código que la desmiente.
2. **La revaluación por importe** (§3.3 y §5.3). Es la pieza nueva y la más arriesgada: una línea
   de ajuste de Inventario que lleva un importe y lo reparte al aprobarse entre lo que sigue en
   bodega y lo ya vendido. ¿Qué secuencia de operaciones entre la factura y la aprobación la deja
   mal (ventas, entradas, devoluciones, otra factura del mismo artículo, anular la factura con el
   ajuste ya aprobado, varias bodegas)? ¿La fórmula de `PriceVariance` escrita en §5.3 da cifras
   correctas con costo promedio ponderado?
3. **La moneda** (§3.3). La diferencia de precio se mide en la moneda del documento y se lleva a la
   de la empresa con las tasas de la entrada; lo demás es diferencia en cambio. ¿Hay algún caso en
   que eso no cuadre con el asiento de H10 §3.4 (varias entradas con tasas distintas en una
   factura, factura con servicios, redondeos)?
4. **La nota de crédito de proveedor** (§3.10 y §4.4) como espejo de la de cliente de H8: ¿falta
   alguna regla que la de cliente tiene en el código y el plan no copia?
5. **Concurrencia.** Cada lectura seguida de una escritura (cupo de lo facturable, saldo, crédito
   disponible): ¿tiene bloqueo, y es compatible con el orden de bloqueo que ya usan entradas y
   devoluciones de compra?
6. **Los asientos de H10 que tocan H9**: ¿cuadra cada uno con lo que H9 guarda? ¿Queda alguna
   cuenta que sólo crece?

## Decisiones ya cerradas — NO las reportes como error

Las tomó Rafael a conciencia. Si crees que una provoca un problema concreto que no está escrito,
repórtalo como **consecuencia** de la decisión, no como propuesta de cambiarla.

- El ajuste de revaluación que genera la factura **nace en borrador** (§3.3).
- El reparto entre bodega y lo vendido **se hace al aprobar el ajuste**, no al facturar (§3.3).
- Facturar **más cantidad de la recibida se rechaza**; no se permite con aviso (§3.9).
- La diferencia de precio **se mide en la moneda del documento** con las tasas de la entrada; la
  diferencia por tasa es de cambio y no toca el inventario (§3.3).
- La `NCP` **copia el diseño de la NCC de H8**: abona sólo la factura citada hasta su saldo, el
  resto es crédito disponible gastado desde Pagos, el pago de emisión no se anula desde Pagos (§3.10).
- La factura de compra **no mueve inventario nunca** (§3.2); el saldo **se calcula en un solo
  sitio** (§3.8); **no hay límite de crédito** con el proveedor (§3.7); la factura **se transcribe**
  y su número del proveedor es único mientras no se anule (§3.1).
- No entran: retención de impuestos, pagos en lote, costos en destino, flujo de aprobación de la
  conciliación, tolerancias configurables (§2 y §9).
- Los asientos van en la moneda de la empresa (H10 §2.8); no hay mayor en dos monedas.

## Cómo reportar

Cada hallazgo con: **qué** falla, **dónde** (sección del plan y, si aplica, `archivo:línea` del
código), **un caso concreto con números** que lo demuestre, y **gravedad** (alta: el hito se
construiría mal o no cuadraría; media: falta una regla; baja: redacción o referencia). Sin cita, el
hallazgo no se puede verificar. Si no encuentras nada en un punto, dilo: también es un resultado.
