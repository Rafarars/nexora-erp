# H7 — Reportes y tablero: informe de las fases 0 a 6

Alcance y **tres dependencias nuevas aprobados por Rafael** antes de construir. Hecho con la misma
dinámica, sin commitear hasta que lo pida; lo decidido sin preguntar está en
`docs/PENDIENTE-REVISION.md`. Con este hito **terminan los hitos del plan**.

**Alcance**: tablero con seis indicadores y dos rankings en el Panel; cuatro reportes descargables
(antigüedad de saldos, estado de cuenta, ventas por cliente, valuación del inventario); verificación
del **contenido** de los archivos generados; **guarda de rendimiento** sobre una empresa con volumen.
Fuera: reportes configurables, envío programado, exportación en cola, gráficas.

Documentación funcional: [`modulos/reportes.md`](modulos/reportes.md).

---

## Fase 0 — Alcance y herramientas

`verlumyx/erp` (`docs/reportes.md`) deja los reportes «por definir» y plantea tablas para reportes
configurables. Se eligieron **reportes fijos en código**: sin tablas ni migración.

| Paquete | Dónde | Por qué este |
|---|---|---|
| `exceljs` | API | Escribe `.xlsx` con celdas numéricas y formato; también lo lee en las pruebas |
| `pdfkit` | API | Genera PDF en Node **sin navegador** dentro del contenedor |
| `pdf-parse` | E2E | Extrae el texto del PDF para afirmarlo |

La primera instalación la bloqueó el permiso de la herramienta (no hacía falta `sudo`); se repitió
con el visto bueno de Rafael.

---

## Fase 1 — Dominio

| Pieza | Qué es |
|---|---|
| `period/report-period.ts` | Rango con ambos extremos, **hasta 366 días**, y «del 1 del mes a hoy» |
| `aging/aging.ts` | Los tramos de cuentas por cobrar, **calculados aquí**: reportes no importa ese contexto |
| `document/report-document.ts` | **La idea central**: título, filtros, columnas con su tipo, filas y totales, sin saber si será PDF o Excel; y el puerto `ReportRenderer` |
| `read-model/reporting-read-model.ts` | Todo lo que se lee de los demás módulos, siempre por empresa |

6 errores; mensajes públicos sin datos internos.

---

## Fase 2 — Aplicación

`DashboardSearcher`, `ReceivablesAgingReport`, `CustomerStatementReport`, `SalesByCustomerReport`,
`InventoryValuationReport`; `report-documents.ts` convierte cada respuesta en documento y
`ReportExports` corre el reporte, lo convierte y lo escribe. El formato se valida **antes** de
consultar.

El valor del inventario se calcula en enteros: existencia en diezmilésimas × costo en millonésimas,
redondeado a céntimos **por fila**.

---

## Fase 3 — Infraestructura

- **`PrismaReportingReadModel`**: SQL de solo lectura sobre `invoices`, `invoice_lines`,
  `customer_payments`, `payment_allocations`, `goods_receipts`, `item_stocks` y el catálogo. Las
  sumas se hacen en PostgreSQL con decimales exactos y llegan como texto.
- **`PdfExcelReportRenderer`**: Excel con números como números (`#,##0.00`), PDF carta con columnas
  alineadas, paginación y coma decimal.
- **Contrato** `reporting-read-model.contract.ts` (6 casos) contra doble y PostgreSQL: solo lo emitido
  y lo confirmado, extremos del periodo, compras redondeadas por línea (3 × 0,333333 = 1,00),
  agrupaciones, existencia con su unidad base y por empresa. El arnés siembra facturas, cobros y
  entradas **con los pedidos, despachos, órdenes y proveedores que piden sus claves ajenas**.

---

## Fase 4 — API

9 rutas bajo `/api/v1/reports` (vista y exportación de cada reporte, más el tablero), 4 permisos
(**79 en total**), 4 ataques nuevos y el tablero y la valuación en la fotografía de Globex. Las
exportaciones responden `StreamableFile` con `Content-Disposition: attachment`.

---

## Fase 5 — Frontend

- Tablero en el **Panel** para quien tenga el permiso.
- `/reportes/{antiguedad,estado-de-cuenta,ventas-por-cliente,valuacion-inventario}` con filtros por
  formulario GET y enlaces de descarga.
- **`/reportes/descargar`**: ruta del servidor de Next que agrega el token de la cookie y reenvía el
  archivo; solo conoce las cuatro exportaciones (probado que no reenvía rutas ajenas).

---

## Fase 6 — Semillas y pruebas end-to-end

- **Empresa Volumen Distribuciones** (`vera@volumen.com`) sembrada en `make seed` por SQL con
  `generate_series`: 50 clientes, 5.000 facturas con pedido y despacho, 3.000 cobros. Toda la semilla
  tarda unos 3 s.
- **API** (`tests/api/reports.api.spec.ts`, 7): cifras exactas del tablero de Globex; **celdas del Excel**
  de antigüedad y de ventas; **texto del PDF** del estado de cuenta y de la valuación; errores de formato
  y periodo; rol de consulta sin valuación.
- **Interfaz** (`tests/ui/reports.spec.ts`, 3): tablero en el Panel y **descarga real** desde la pantalla,
  leída como Excel y como PDF.
- **Rendimiento** (`tests/performance/volume.perf.spec.ts`, 3), proyecto propio que corre solo, después
  de los demás y antes de resiliencia; mediana de tres llamadas tras calentar:

| Guarda | Medido en local | Umbral |
|---|---|---|
| Listar 5.000 facturas por cobrar | ~150 ms | 1.500 ms |
| Tablero | ~65 ms | 1.000 ms |
| Antigüedad a Excel | ~95 ms | 1.500 ms |

---

## Revisión rigurosa

| Hallazgo | Cómo apareció | Arreglo |
|---|---|---|
| **El valor del inventario salía cien veces menor** (2,5 kg a 3,333333 daba 0,08) | Prueba de aplicación | La división de escala era 10¹⁰ y debía ser 10⁸ |
| **Dos controladores por archivo** dejaban la exportación fuera de la vigilancia de aislamiento, que lee el primer `@Controller` de cada archivo | Revisión de la convención | Un controlador por archivo |
| **Un DTO compartido** con `warehouseId` hacía que la vigilancia pidiera ataques para rutas sin identificadores | Prueba de cobertura del aislamiento | La consulta de valuación en su propio DTO |
| El arnés del contrato usaba identificadores y abreviaturas del catálogo del contrato de ventas: según el orden de ejecución, un contrato rompía al otro | Contrato completo, primera corrida | Catálogo propio del contrato de reportes |
| Facturas de prueba que vencían antes de emitirse, y una de otra empresa con un artículo ajeno | `CHECK` y claves ajenas de PostgreSQL (el doble no las tiene) | Datos del contrato corregidos |
| **Defecto latente del H6**: los arneses de los contratos de acceso y catálogo vacían la base sin borrar los cobros; con cobros sembrados, borrar facturas choca con `payment_allocations`. Explica un fallo suelto del contrato de acceso visto durante el H6 | `make verify-clean`, con la semilla de Volumen en la base | Los dos arneses borran los cobros primero |
| **La carrera de navegación del H5 seguía viva bajo carga**: tres pruebas distintas (kardex, facturas por cobrar, catálogo) fallaron en tres corridas completas, con 21 repeticiones en verde por separado. El clic en la sección, si llega mientras termina la redirección del módulo, se pierde | Corridas completas de la suite (el proyecto nuevo de rendimiento suma carga al final) | Los seis page objects vuelven a pulsar la sección dentro de la misma espera si la dirección no cambia. Cambio de pruebas, no del sistema; la causa exacta en Next queda por confirmar |

---

## Validación

`make verify-clean` (cambiaron las dependencias) reinstaló desde cero y pasó secretos, lint, tipos y unitarias; falló en el contrato por el defecto de los arneses. Tras el arreglo, `make verify` y la suite end-to-end completa (con el reintento del clic), en verde:

| Suite | Resultado |
|---|---|
| API unitarias | 2111 |
| Web unitarias | 145 |
| Contrato contra PostgreSQL | 126 |
| End-to-end | 300 |
