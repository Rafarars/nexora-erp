Busca huecos en el plan de los hitos H8 y H9 de este ERP. El plan todavía no está
implementado: lo que se revisa es el diseño sobre el papel, antes de escribir código.

## Qué leer

- `docs/PLAN.md`, secciones **H8** y **H9** (el resumen, líneas 371 a 397 aproximadamente).
  El resto del documento sirve de contexto: estructura del repositorio, contextos
  delimitados, puertos y adaptadores, multitenencia y estrategia de pruebas.
- `docs/H8-NOTAS-DE-CREDITO-Y-DEVOLUCIONES.md`, el plan detallado de H8.
- `docs/H9-CONTABILIDAD.md`, el plan detallado de H9.

Para entender contra qué se apoya cada cosa, están también los hitos ya terminados:
`docs/H3-INVENTARIO.md` (kardex y costo promedio), `docs/H4-COMPRAS.md`,
`docs/H5-VENTAS.md` y `docs/H6-CUENTAS-POR-COBRAR.md` (el saldo de la factura).

## Qué buscar

**1. Huecos de cobertura.** Casos de negocio que las reglas escritas no resuelven. Una
operación sin regla, un estado sin transición definida, una secuencia de acciones que deja
el sistema en un estado que ninguna regla contempla. Por ejemplo, y solo como forma de
pensarlo: qué pasa si una acción se repite, si llega fuera de orden, o si se deshace algo
sobre lo que ya se hizo otra cosa.

**2. Invariantes que se pueden violar.** Los dos documentos declaran invariantes fuertes:
en H8, que la nota de crédito no toca el saldo directamente (§3.2), que el cupo de cantidad
y el de importe son distintos (§3.3), que la mercancía se valora al costo congelado (§3.4),
que no se permite existencia negativa (§3.7). En H9, que un asiento nace cuadrado o no nace
(§2.1), que se escribe en la misma transacción que la operación (§2.3), que el costo de
ventas sale del kardex (§2.4). Busca un camino, aunque sea raro, por el que alguna de esas
afirmaciones deje de ser cierta con las reglas tal como están escritas.

**3. Consistencia entre H8 y H9.** Son dos hitos consecutivos que se tocan: H8 introduce
documentos y movimientos nuevos, H9 define qué operaciones generan asiento contable y cómo.
Verifica que el conjunto cierre, en los dos sentidos.

**4. Consistencia entre el resumen y el detalle.** Las secciones H8 y H9 de `PLAN.md`
resumen cada hito en pocas líneas y declaran «la decisión que lo define». Comprueba que ese
resumen no afirme nada que el documento detallado contradiga, ni prometa nada que el
detallado no entregue.

**5. Consistencia con lo ya construido.** H8 y H9 se apoyan en hitos terminados. Si alguno
de los dos asume un comportamiento del kardex, del saldo de la factura o del costo promedio
que los documentos de H3 a H6 no respaldan, es un hueco.

**6. Fases que no alcanzan.** Cada hito tiene su lista de fases numeradas. Comprueba que
las fases cubran todo lo que el propio documento declara como alcance: si una regla está
escrita en las decisiones de diseño pero ninguna fase la construye, falta una fase.

No te limites a esta lista. Si ves otra cosa que deje el plan incompleto, repórtala.

## Cómo reportar

Un hueco necesita ser accionable: di **qué caso concreto** queda sin resolver y **qué
regla falta**, no una impresión general de que «podría faltar algo». La cita textual debe
ser de la línea del plan donde falta la regla, o de la que la contradice.

## Decisiones ya cerradas (no las reportes como errores)

Los dos documentos declaran a propósito qué dejan fuera, y esas exclusiones están
razonadas. No son huecos.

**H8 excluye deliberadamente**, en su sección «No entra, y por qué»: las notas de débito,
los anticipos de cliente y de proveedor, las series y correlativos fiscales, y la bodega de
cuarentena. También tiene una sección «Lo que este plan NO resuelve»: lo que esté ahí es
una limitación conocida y aceptada.

**H9 excluye deliberadamente**, en su tabla de alcance: el cierre de ejercicio, los estados
financieros, los impuestos y declaraciones, los asientos escritos a mano, los centros de
costo y presupuestos, y la conciliación bancaria. Tampoco hay periodos contables (§2.7) ni
multimoneda (§2.8), y las dos ausencias están argumentadas. H9 también tiene su sección
«Lo que este plan NO resuelve».

**Otras decisiones cerradas del proyecto**, que no se reabren:

- Es un portafolio para demostrar automatización de pruebas, no un ERP comercial. Que algo
  sea más simple que un producto real no es un defecto por sí mismo; el criterio es si la
  regla escrita se sostiene, no si el sistema compite con un ERP de mercado.
- La arquitectura de contextos delimitados con puertos y adaptadores está decidida, y
  también la multitenencia (`PLAN.md` §4).
- Los hitos H0 a H7 están terminados. No propongas rehacerlos: si H8 o H9 chocan con ellos,
  el hallazgo es sobre H8 o H9.
- El orden de los hitos está decidido: H8 antes que H9.

Que un documento declare un riesgo en su sección «Riesgos» significa que ya se vio. Solo es
hallazgo si el riesgo declarado no tiene mitigación en ninguna fase, o si la mitigación que
propone no lo cubre.
