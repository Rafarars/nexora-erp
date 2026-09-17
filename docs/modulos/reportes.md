# Reportes y tablero

**Cuánto se vendió, compró y cobró en el mes**, **cuánto se debe y cuánto vale el inventario hoy**, y
los mismos listados de los módulos **listos para descargar en PDF o Excel**.

Contexto: `apps/api/src/contexts/reporting` · Pantallas: `/` (tablero en el Panel) y `/reportes/*` ·
Informe técnico: [`../H7-REPORTES.md`](../H7-REPORTES.md)

| Submódulo | Qué es | Formatos |
|---|---|---|
| Tablero | Seis indicadores y dos rankings en el Panel | Pantalla |
| Antigüedad de saldos | Lo que debe cada cliente por tramos de vencimiento | PDF y Excel |
| Estado de cuenta | Facturas y cobros de un cliente con saldo corrido | PDF (y Excel por API) |
| Ventas por cliente | Lo facturado en un periodo, por cliente | PDF y Excel |
| Valuación del inventario | Existencia al costo promedio, por bodega | PDF y Excel |

**No tiene tablas ni escribe nada.** Lee las de Ventas, Compras, Cuentas por cobrar e Inventario por
su propio adaptador, sin importar código de esos módulos. Los reportes están fijos en el código: no
hay reportes configurables por el usuario ni envíos programados ([FUTURE.md](../FUTURE.md)).

---

## Principios

1. **Un reporte dice lo mismo que su pantalla.** La antigüedad del reporte y la de Cuentas por cobrar
   usan los mismos tramos; las cifras de ventas son las de las facturas emitidas.
2. **El archivo es el mismo reporte, no otro cálculo.** Descargar corre el reporte de la pantalla, lo
   convierte en un documento (título, filtros, columnas, filas, totales) y ese documento se escribe
   como PDF o Excel. Por eso lo que se ve y lo que se descarga no pueden diferir.
3. **En Excel los números son números.** Se pueden sumar, ordenar y filtrar; el formato (dos
   decimales, miles) es solo de presentación.
4. **Todo en enteros.** Sumar miles de facturas en coma flotante deja restos; los importes se llevan en
   diezmilésimas y se redondean a los decimales de importe de la empresa (`amount_decimals`).
5. **Todo en la moneda de la empresa** (§0): un reporte nunca suma euros con dólares.
6. **Cada reporte tiene su permiso.** El que muestra costos (valuación) no lo ve cualquiera.

---

## 0. La moneda de los reportes

Cada documento guarda su moneda y **las dos tasas que congeló**: la suya y la de la moneda de la empresa
([empresa.md §4](empresa.md#4-tasas-de-cambio--exchange_rates)). Los reportes convierten cada documento
con **sus** tasas y suman el resultado, redondeado a los decimales de la empresa:

```
importe en la moneda de la empresa = importe × tasa del documento ÷ tasa de la empresa
```

- Una factura de 100 € emitida con el euro a 40 y el dólar a 36,50 vale **109,59 USD**, hoy y dentro de
  diez años: no se consulta ninguna tasa nueva.
- **Lo anterior al multimoneda** no tiene tasas y ya estaba en la moneda de la empresa: se suma tal cual.
- **El cobro** se convierte con las tasas del cobro; **lo que rebaja de cada factura**, con las de esa
  factura.
- **El costo promedio del inventario ya está en la moneda de la empresa**: el inventario lo convierte al
  recibir la mercancía ([compras.md §3.3](compras.md#33-la-entrada-y-el-costo)), así que la valuación no
  convierte nada.
- Cada respuesta dice su `currency`; la pantalla lo muestra junto a los importes y el PDF y el Excel lo
  escriben bajo el título («Importes en USD»).

**Dónde se convierte:** en el SQL del modelo de lectura, antes de agrupar. Sumar y convertir después
daría otra cifra.

---

## 1. Tablero

Se muestra en el **Panel** a quien tenga `reports.dashboard.search`. Quien no lo tenga sigue viendo el
Panel con los datos de su sesión.

| Indicador | Qué suma | Periodo |
|---|---|---|
| Ventas del mes | Total (con impuesto) de las facturas **emitidas** | Del 1 del mes hasta hoy |
| Compras recibidas del mes | Cantidad × costo de las líneas de **entradas confirmadas**, redondeado por línea, **sin impuesto** | Del 1 del mes hasta hoy |
| Cobrado en el mes | Importe de los **cobros confirmados** | Del 1 del mes hasta hoy |
| Saldo por cobrar | Lo que deben todas las facturas emitidas | Hoy |
| Vencido | La parte de ese saldo cuyas facturas ya vencieron | Hoy |
| Valor del inventario | Existencia × costo promedio, redondeado por fila | Hoy |

Además: **los 5 clientes que más deben** (con su vencido) y **los 5 artículos más vendidos del mes**
por subtotal.

**Ejemplo (Globex, datos de demostración):** Talleres Omega debe 61,20 (factura de 81,20 menos un cobro
de 20); hay 25 filtros a 8,50 → inventario 212,50.

**Por qué las compras van sin impuesto y las ventas con él:** la compra se valora a costo, que es lo
que entra al inventario; la venta es lo que se le factura al cliente. Mezclarlas con el mismo criterio
confundiría el margen. Queda anotado para revisar ([PENDIENTE-REVISION] punto 15).

**Por qué «compras recibidas» y no «órdenes de compra»:** una orden confirmada todavía no es mercancía
ni deuda; la entrada sí.

---

## 2. Antigüedad de saldos

Idéntica a la de [Cuentas por cobrar §4](cuentas-por-cobrar.md#4-antigüedad-de-saldos): por cliente que
debe algo, tramos **por vencer, 1–30, 31–60, 61–90 y más de 90 días**, más la fila de totales. El
archivo lleva la empresa y la fecha de corte (`antiguedad-de-saldos-2026-09-14.xlsx`).

---

## 3. Estado de cuenta

El de [Cuentas por cobrar §5](cuentas-por-cobrar.md#5-estado-de-cuenta) en una hoja para entregarle al
cliente. Encabezado: empresa, código e identificación fiscal del cliente, plazo y límite, fecha de corte,
saldo y vencido. En la pantalla se elige entre los clientes con saldo; por API sirve para cualquier
cliente de la empresa. Uno de otra empresa responde **404**.

---

## 4. Ventas por cliente

Facturas **emitidas** entre dos fechas (ambas incluidas), agrupadas por cliente: cantidad de facturas,
subtotal, impuesto y total, del que más compró al que menos, con totales.

| Regla | Por qué |
|---|---|
| Periodo de **hasta un año** (366 días) | Sin tope, un reporte barre todas las facturas de la empresa |
| La fecha final no puede ser anterior a la inicial | `InvalidReportPeriodError` |
| Por defecto, **del 1 del mes a hoy** | Es la pregunta más frecuente |
| Las facturas anuladas no cuentan | No son venta |

**Ejemplo:** del 01-09-2026 al 30-09-2026, Comercial Delta: 1 factura, subtotal 60,00, IVA 9,60,
total 69,60.

---

## 5. Valuación del inventario

Por artículo y bodega con existencia distinta de cero: existencia en **unidad base**, costo promedio y
valor (existencia × costo, redondeado a céntimos por fila), con el total. Filtro opcional por bodega;
una bodega de otra empresa responde **404**.

**Ejemplo (Acme, Principal):** agua 288 un × 0,50 = 144,00.

**Consecuencia que hay que saber explicar:** si el costo promedio tiene más decimales que los importes de
la empresa, el valor de cada fila se redondea y **el total es la suma de las filas redondeadas**, no el
redondeo de la suma. Puede
diferir en un céntimo de multiplicar la existencia total por un costo. Así el total coincide con lo que
se ve renglón por renglón.

---

## 6. API y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Tablero | `GET /api/v1/reports/dashboard` | `reports.dashboard.search` |
| Antigüedad | `GET /api/v1/reports/receivables-aging`, `…/export?format=pdf\|xlsx` | `reports.receivables.search` |
| Estado de cuenta | `GET /api/v1/reports/customers/:customerId/statement`, `…/statement/export?format=` | `reports.receivables.search` |
| Ventas por cliente | `GET /api/v1/reports/sales-by-customer?from=&to=`, `…/export?format=&from=&to=` | `reports.sales.search` |
| Valuación | `GET /api/v1/reports/inventory-valuation?warehouseId=`, `…/export?format=&warehouseId=` | `reports.inventory.search` |

Las exportaciones responden el archivo con `Content-Type` y `Content-Disposition: attachment;
filename="…"`. La web las descarga por `/reportes/descargar?reporte=&formato=…`, una ruta del servidor
de Next que agrega el token y **solo reenvía las cuatro exportaciones conocidas**.

**Errores**

| Código | HTTP | Cuándo |
|---|---|---|
| `InvalidExportFormatError` | 400 | Formato distinto de `pdf` o `xlsx` |
| `ReportPeriodTooLongError` | 400 | Periodo mayor a un año |
| `InvalidReportPeriodError` | 400 | La fecha final es anterior a la inicial |
| `InvalidReportDateError` | 400 | Fecha que no existe |
| `ReportCustomerNotFoundError` / `ReportWarehouseNotFoundError` | 404 | Cliente o bodega inexistente o de otra empresa |

---

## 7. Pantallas

| Ruta | Qué muestra |
|---|---|
| `/` (Panel) | Datos de la sesión y, con permiso, el **tablero** |
| `/reportes/antiguedad` | Tabla por cliente y tramo con totales; descargar PDF o Excel |
| `/reportes/estado-de-cuenta?cliente=` | Selector de clientes con saldo, resumen y movimientos; descargar PDF |
| `/reportes/ventas-por-cliente?desde=&hasta=` | Fechas (por defecto el mes), tabla y totales; descargar PDF o Excel |
| `/reportes/valuacion-inventario?bodega=` | Filtro de bodega, tabla y total; descargar PDF o Excel |

---

## 8. Datos de demostración

| Empresa | Qué hay |
|---|---|
| Globex | Deuda de 61,20 de Talleres Omega e inventario de 212,50: las cifras exactas de las pruebas |
| **Volumen Distribuciones** (`vera@volumen.com`) | 50 clientes, **5.000 facturas** con pedido y despacho, **3.000 cobros**: la empresa de las guardas de rendimiento |

El rol **Consulta** de Acme ve tablero, antigüedad, estados de cuenta y ventas, pero **no la
valuación**, que muestra costos.

---

## 9. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio | `contexts/reporting/domain/**/*.spec.ts` | Periodo (extremos, año bisiesto, tope), tramos, formatos, errores |
| Aplicación | `reporting.spec.ts` | Cada reporte y su documento con las mismas cifras; valor por fila con los decimales de la empresa; **una factura en euros convertida en todos los reportes**; aislamiento |
| Contrato | `reporting-read-model.contract.ts` | Contra doble y PostgreSQL: solo emitido y confirmado, extremos del periodo incluidos, compras redondeadas por línea, agrupaciones, existencia con unidad base y por empresa, **cada documento convertido con las tasas que congeló** |
| Generador | `report-renderer.spec.ts` | El Excel se reabre y trae números con formato; el PDF es PDF; coma decimal |
| API | `tests/api/reports.api.spec.ts` | **Contenido de los archivos**: celdas del Excel y texto del PDF contra los datos sembrados; **una factura en euros que suma en dólares**; errores; permisos |
| Interfaz | `tests/ui/reports.spec.ts` | Tablero en el Panel con su moneda, **descarga real** desde la pantalla leída como Excel y como PDF, rol de consulta |
| Rendimiento | `tests/performance/volume.perf.spec.ts` | Umbrales sobre la empresa Volumen: listado de 5.000 facturas, tablero y exportación de la antigüedad |
| Aislamiento | `tests/isolation/*` | 4 ataques a estados de cuenta y valuación de otra empresa |
