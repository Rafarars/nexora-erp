Busca huecos en el plan de los hitos H8, H9 y H10 de este ERP. Ninguno está
implementado: lo que se revisa es el diseño sobre el papel, antes de escribir código.

Los tres son consecutivos y dependen unos de otros, y esa cadena es donde más probable es
que haya huecos. Se construyen en este orden: **H8, luego H9, luego H10.**

## Qué leer

- `docs/PLAN.md`, secciones **H8**, **H9** y **H10** (el resumen de cada hito, a partir de
  la línea 371). El resto del documento da el contexto: estructura del repositorio,
  contextos delimitados, puertos y adaptadores, multitenencia y estrategia de pruebas.
- `docs/H8-NOTAS-DE-CREDITO-Y-DEVOLUCIONES.md`, plan detallado de H8: devolución de venta,
  nota de crédito a cliente y devolución de compra.
- `docs/H9-COMPRAS-HASTA-EL-PAGO.md`, plan detallado de H9: factura de compra, pago a
  proveedor, saldo del proveedor y nota de crédito de proveedor.
- `docs/H10-CONTABILIDAD.md`, plan detallado de H10: partida doble generada desde las
  operaciones.

Para saber contra qué se apoya cada cosa, están los hitos ya terminados:
`docs/H3-INVENTARIO.md` (kardex y costo promedio), `docs/H4-COMPRAS.md` (órdenes y
entradas de mercancía), `docs/H5-VENTAS.md` (factura de venta y despachos) y
`docs/H6-CUENTAS-POR-COBRAR.md` (cobros y saldo de la factura).

## Qué buscar

**1. Huecos de cobertura.** Casos de negocio que las reglas escritas no resuelven: una
operación sin regla, un estado sin transición definida, una secuencia de acciones que deja
el sistema en un estado que ninguna regla contempla. Como forma de pensarlo: qué pasa si
una acción se repite, si llega fuera de orden, o si se deshace algo sobre lo que ya se hizo
otra cosa después.

**2. Invariantes que se pueden violar.** Los tres documentos declaran invariantes fuertes.
En H8: la nota de crédito no toca el saldo directamente (§3.2), el cupo de cantidad y el de
importe son distintos (§3.3), la mercancía se valora al costo congelado (§3.4), no se
permite existencia negativa (§3.7). En H9: la factura de compra no mueve inventario nunca
(§3.2), lo pedido es mayor o igual que lo recibido y eso mayor o igual que lo facturado
(§3.4), el saldo se calcula en un solo sitio (§3.8), una factura del proveedor no se
registra dos veces (§3.1). En H10: un asiento nace cuadrado o no nace (§2.1), se escribe en
la misma transacción que la operación (§2.3), el costo de ventas sale del kardex (§2.4).
Busca un camino, por raro que sea, por el que alguna de esas afirmaciones deje de ser
cierta con las reglas tal como están escritas.

**3. La cadena entre los tres hitos.** Es el punto más importante de esta revisión. H8
introduce documentos y movimientos nuevos. H9 introduce otros, y además declara en su §1.2
que la contabilidad no se sostiene sin él. H10 define qué operaciones generan asiento
contable y con qué cuentas. Verifica que el conjunto cierre **en los dos sentidos**: que
cada cosa que H8 y H9 crean tenga el tratamiento que H10 necesita, y que todo lo que H10
supone exista efectivamente en H8 y H9. Presta atención también a las cuentas contables que
H10 nombra: si alguna solo puede crecer y nada la mueve en sentido contrario, eso es un
hueco.

**4. Consistencia entre el resumen y el detalle.** Las secciones H8, H9 y H10 de `PLAN.md`
resumen cada hito en pocas líneas y declaran «la decisión que lo define». Comprueba que ese
resumen no afirme nada que el documento detallado contradiga, ni prometa nada que el
detallado no entregue.

**5. Referencias cruzadas que no cuadran.** Los tres documentos se citan entre sí por
número de hito y de sección. Comprueba que cada referencia apunte a donde dice: que el hito
citado sea el correcto, que la sección exista, y que diga lo que el que la cita afirma que
dice.

**6. Consistencia con lo ya construido.** Los tres hitos se apoyan en hitos terminados. Si
alguno asume un comportamiento del kardex, del saldo de la factura, del costo promedio, de
las entradas de mercancía o de los cobros que los documentos de H3 a H6 no respaldan, es un
hueco.

**7. Fases que no alcanzan.** Cada hito tiene su lista de fases numeradas. Comprueba que
cubran todo lo que el propio documento declara como alcance: si una regla está escrita en
las decisiones de diseño pero ninguna fase la construye, falta una fase.

No te limites a esta lista. Si ves otra cosa que deje el plan incompleto, repórtala.

## Cómo reportar

Un hueco necesita ser accionable: di **qué caso concreto** queda sin resolver y **qué regla
falta**, no una impresión general de que «podría faltar algo». La cita textual debe ser de
la línea del plan donde falta la regla, o de la que la contradice.

## Decisiones ya cerradas (no las reportes como errores)

Los tres documentos declaran a propósito qué dejan fuera, y esas exclusiones están
razonadas. No son huecos.

**H8 excluye**, en «No entra, y por qué»: notas de débito, anticipos de cliente y de
proveedor, series y correlativos fiscales, y bodega de cuarentena.

**H9 excluye**, en «No entra, y por qué»: la retención de impuestos, que ya es un hito
propio decidido; el límite de crédito con el proveedor, que según §3.7 **no debe existir**;
la programación de pagos en lote; los costos en destino; el flujo de aprobación jerárquica
de la conciliación; y las tolerancias configurables.

**H10 excluye**, en su tabla de alcance: cierre de ejercicio, estados financieros,
impuestos y declaraciones, asientos escritos a mano, centros de costo y presupuestos, y
conciliación bancaria. Tampoco hay periodos contables (§2.7) ni multimoneda (§2.8), y las
dos ausencias están argumentadas.

Los tres tienen además una sección «Lo que este plan NO resuelve»: lo que esté ahí es una
limitación conocida y aceptada.

**Una pregunta abierta, declarada como tal.** H9 §3.9 deja sin decidir si facturar de más
se rechaza o se permite con aviso, y lo dice explícitamente. Señalar que está sin decidir
no aporta nada, porque ya se sabe. Sí aporta un argumento o una consecuencia que el
documento no haya considerado al plantearla.

**Otras decisiones cerradas del proyecto**, que no se reabren:

- Es un portafolio para demostrar automatización de pruebas, no un ERP comercial. Que algo
  sea más simple que un producto real no es un defecto por sí mismo: el criterio es si la
  regla escrita se sostiene, no si el sistema compite con un ERP de mercado.
- La arquitectura de contextos delimitados con puertos y adaptadores está decidida, y
  también la multitenencia (`PLAN.md` §4).
- Los hitos H0 a H7 están terminados. No propongas rehacerlos: si H8, H9 o H10 chocan con
  ellos, el hallazgo es sobre el hito nuevo.
- El orden H8, H9, H10 está decidido, y H9 §1.2 explica por qué H9 va antes que la
  contabilidad.

Que un documento declare un riesgo en su sección «Riesgos» significa que ya se vio. Solo es
hallazgo si el riesgo declarado no tiene mitigación en ninguna fase, o si la mitigación que
propone no lo cubre.
