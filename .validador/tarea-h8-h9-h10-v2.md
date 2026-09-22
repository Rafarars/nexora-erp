Esto es una RE-validación. El plan de los hitos H8, H9 y H10 ya pasó por un panel igual a
este el 21-sep-2026, que encontró 41 hallazgos, y el autor los corrigió todos ese mismo
día. Tu trabajo NO es repetir la revisión anterior desde cero: es comprobar si las
correcciones se hicieron bien y si, al corregir, se introdujo algo nuevo que se rompió.

Ninguno de los tres hitos está implementado: sigue siendo diseño sobre el papel.

## Qué leer

- `docs/PLAN.md`, secciones H8, H9 y H10.
- `docs/H8-NOTAS-DE-CREDITO-Y-DEVOLUCIONES.md` (543 líneas).
- `docs/H9-COMPRAS-HASTA-EL-PAGO.md` (513 líneas).
- `docs/H10-CONTABILIDAD.md` (560 líneas). H10 §3 ahora tiene DOCE operaciones, no cinco:
  léelas todas, de §3.1 a §3.12, más la tabla de doble dirección por cuenta que abre esa
  sección (justo antes de §3.1).

Para el terreno ya construido: `docs/H3-INVENTARIO.md`, `docs/H4-COMPRAS.md`,
`docs/H5-VENTAS.md`, `docs/H6-CUENTAS-POR-COBRAR.md`.

## Las trece correcciones a verificar

Cada una es una afirmación del autor. Compruébala contra el documento real, no la des por
buena. Si una cita no coincide exactamente con lo que dice el archivo, es un hallazgo.

1. **H10 §3 pasó de cinco operaciones a doce**, y antes de §3.1 hay una tabla que dice, por
   cada cuenta, qué operación la debita y qué operación la acredita. Verifica que las doce
   estén, que la tabla sea internamente consistente con los asientos de §3.1 a §3.12, y que
   ninguna cuenta se quede con una sola dirección.
2. **La cuenta que recibe la entrada de mercancía cambió**, de "Proveedores por pagar" a
   una cuenta puente nueva, "Mercancía por facturar" (§3.1), que la factura de compra
   liquida después (§3.4). Verifica que esta cuenta puente esté en la lista de cuentas
   configurables de §2.5 y que su ciclo cierre: algo la debita y algo distinto la acredita.
3. **El costo de ventas se movió de la factura al despacho** (§2.4.1). Verifica que §3.2
   (el despacho) contabilice el costo, que §3.3 (la factura de venta) ya NO lo haga, y que
   quede explicado qué pasa con una factura de solo servicios, que no tiene despacho.
4. **Cuatro cuentas nuevas** se agregaron a la lista de §2.5: "Notas de crédito por
   aplicar", "Notas de crédito de proveedor por aplicar", "Mercancía por facturar" y
   "Diferencia de precio de compra". Verifica que cada una tenga su asiento de origen y su
   asiento de cierre en algún lugar de §3.
5. **En H8, `reversalOfId` se separó de la devolución parcial.** La unicidad
   `@@unique([reversalOfId])` se queda para anular documentos enteros; las devoluciones
   parciales usan una columna nueva sin unicidad (§3.4). Verifica que el esquema de §5.1
   incluya esa columna nueva y que ningún otro punto del documento siga asumiendo que
   `reversalOfId` sirve también para devoluciones.
6. **El reparto del cobro por nota de crédito ahora topa en el saldo vivo** de cada
   factura, y lo que sobra queda como saldo a favor del cliente (H8 §3.2, regla 3 y 4).
   Antes decía que un cobro sin reparto "ya lo soporta el reparto actual", y eso era falso:
   el código rechaza un cobro con cero repartos. Verifica que la corrección declare
   explícitamente dónde vive ese saldo a favor cuando no cabe en ninguna factura, o si
   sigue siendo una decisión pendiente.
7. **La pérdida de una devolución `scrap` ya no se registra "por Ajuste"**, sino por la
   nota de crédito, con su asiento en H10 §3.7. Verifica que H10 §3.7 (nota de crédito a
   cliente) contemple ese caso, o si el asiento de la pérdida por `scrap` queda en otro
   lado sin decirlo.
8. **La nota de crédito de proveedor se sacó del alcance de H8** y ahora vive solo en H9
   §3.10. Verifica que H8 no vuelva a mencionarla en ningún esqueleto, tabla de fases o
   conteo de tablas, y que el conteo de tablas de la base de datos de H8 §5.1 corresponda a
   tres documentos, no a cuatro.
9. **"Nueve sitios" pasó a describirse como "nueve cálculos repartidos por dieciséis
   sitios".** Verifica que esa cifra sea consistente entre `PLAN.md`, H8 y H9 en los tres
   lugares donde se menciona.
10. **La diferencia de precio sobre mercancía ya vendida ahora se guarda** en una columna
    de la factura de compra, `soldDifference` (H9 §3.3 y esquema en §5.2), y se lleva a la
    cuenta "Diferencia de precio de compra" en H10 §3.4. Verifica que el flujo completo,
    desde que se detecta la diferencia hasta que llega al asiento, quede sin huecos.
11. **La factura de compra normaliza su número antes de comparar**, y una factura anulada
    libera el número que ocupaba (H9 §3.1). Verifica que el esquema de §5.2 refleje esto
    (probablemente con un índice parcial, como el documento menciona que ya existe en
    ventas) y no solo la restricción de unicidad simple.
12. **Se agregó `AccountingEvent`**, el tipo que faltaba en el puerto de contabilización
    (H10 §4.4). Verifica que cubra las doce operaciones de §3, y que ningún caso de §3.1 a
    §3.12 se quede sin una variante correspondiente en el tipo.
13. **Se agregó el puerto `PayableBalances`** en H9 §5.3, análogo al `RECEIVABLE_BALANCES`
    de H6. Verifica que quien necesita el saldo del proveedor (reportes, contabilidad) lo
    consuma por ese puerto y no recalculándolo por su cuenta.

## Además de verificar las trece, sigue buscando huecos nuevos

Las correcciones pueden haber introducido problemas que no existían antes. Presta especial
atención a:

- **Consistencia entre H8, H9 y H10** ahora que H10 tiene el doble de operaciones.
- **Las cuentas nuevas**, que son las piezas menos probadas del conjunto.
- **La separación `reversalOfId` / columna nueva de devolución**, que es el cambio de
  esquema más delicado: dos columnas conviviendo sobre el mismo kardex.
- Cualquier otra cosa que las trece correcciones no cubran.

## Cómo reportar

Un hueco necesita ser accionable: qué caso concreto queda sin resolver y qué regla falta,
con cita exacta. Para las trece correcciones, di explícitamente si quedó BIEN, MAL o
PARCIAL, citando la línea que lo demuestra.

## Decisiones ya cerradas (no las reportes como errores)

**Las siguientes siete afirmaciones ya se verificaron contra el código real en la ronda
anterior y son correctas. No vuelvas a cuestionarlas, solo confirma que el texto vigente
las siga reflejando:**

- Un cobro sin ninguna aplicación se rechaza en el dominio ya construido
  (`customer-payment.entity.ts:215`, `EmptyPaymentError`).
- `@@unique([reversalOfId])` existe en el esquema con el comentario "un movimiento se
  revierte una sola vez".
- Se puede facturar mercancía física antes de despacharla
  (`sales-order.entity.ts:206-226`): es un defecto real en código ya terminado, no una
  interpretación del plan.

**Y las siguientes fueron reportadas por el panel anterior y DESCARTADAS con cita. Siguen
descartadas; no las repitas salvo que encuentres una razón nueva y distinta:**

- "Facturar de más es una paradoja de diseño irresoluble": H9 fase 2 (conciliación) sí
  implementa la decisión de rechazar, tomada en §3.9. No hay paradoja.
- "Dependencia circular en la devolución ciega, el costo se necesita antes de existir": el
  costo lo aporta el movimiento de salida que generó el despacho original, que existe desde
  antes de la devolución. No es circular.
- "El puerto de contabilización no devuelve el asiento en el resultado": ya lo devuelve,
  como una instrucción más del resultado declarativo.
- "Falta una fase que implemente la regla de scrap / factura de servicios / refresco de
  costo promedio tras devolución": esas reglas viven dentro de funcionalidades que ya
  tienen fase propia y prueba listada; no son fases aparte.

**Otras decisiones del proyecto que siguen sin tocarse:**

- Es un portafolio para demostrar automatización de pruebas, no un ERP comercial.
- La arquitectura de contextos delimitados con puertos y adaptadores, y la multitenencia,
  están decididas (`PLAN.md` §4).
- Los hitos H0 a H7 están terminados. Si algo de H8, H9 o H10 choca con ellos, el hallazgo
  es sobre el hito nuevo.
- El orden H8, H9, H10 está decidido.
- H8 excluye a propósito: notas de débito, anticipos, series y correlativos fiscales,
  bodega de cuarentena.
- H9 excluye a propósito: retención de impuestos (hito propio ya decidido), límite de
  crédito con el proveedor (no debe existir, según §3.7), programación de pagos en lote,
  costos en destino, aprobación jerárquica de la conciliación, tolerancias configurables.
- H10 excluye a propósito: cierre de ejercicio, estados financieros, impuestos y
  declaraciones, asientos escritos a mano, centros de costo y presupuestos, conciliación
  bancaria, periodos contables, multimoneda.
- La pregunta sobre si un ajuste de revaluación nace confirmado o en borrador sigue abierta
  a propósito en H9 §3.3; no es un hallazgo señalar que está sin decidir.
