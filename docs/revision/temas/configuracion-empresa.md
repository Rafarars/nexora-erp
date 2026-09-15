# Tema: configuración de la empresa

**Pregunta** (del [checklist](../README.md#temas-por-investigar-y-ubicar)): qué valores lleva la
configuración de una empresa y dónde vive. Se investiga antes de construir, como pidió Rafael, para no
tener que moverla después.

**Fecha:** 15-sep-2026. **Estado:** decidido; en construcción por pasos (§8.4).

---

## 1. Qué guarda hoy el sistema

La empresa (`tenants`, contexto `access`) tiene **nombre, slug y estado**. Nada más. Todo lo que en un ERP es
configuración vive hoy fijo en el código o repartido por los maestros:

| Valor | Dónde está hoy | Consecuencia |
|---|---|---|
| Moneda | No existe. Los importes son números sin moneda (`formatMoney`, `formatAmount`) | Un reporte o una factura no dice en qué moneda está |
| Datos fiscales de la empresa (RIF/NIF, dirección, teléfono, correo) | No existen. Clientes y proveedores sí tienen `fiscal_id` | Los PDF de reportes solo llevan el nombre (`companyName` del modelo de lectura de reportes) |
| Logo | No existe | Espera al módulo de adjuntos (decidido) |
| Zona horaria | **UTC fijo**: «hoy» sale de `toISOString().slice(0, 10)` en la API (`adjustment-date.vo.ts`, `purchase-date.vo.ts`, `sales-date.vo.ts`, `report-date.vo.ts`) y en la web (fecha propuesta de ajustes, órdenes, pedidos, despachos y cobros). Los contenedores corren en `UTC` | En Venezuela (UTC−4), desde las 8 de la noche el sistema propone la fecha de **mañana**, y la antigüedad de saldos cuenta un día de más |
| Decimales | Fijos por convención ([modulos/README.md](../../modulos/README.md#decimales)): cantidades 4, costos 6, porcentajes 4, importes 2 | Correcto para el alcance; no configurable |
| Bodega por defecto | Marca `is_default` en `warehouses` (catálogo) | Ya funciona; es configuración, pero vive en su maestro |
| Plazo de pago y límite de crédito | Por cliente y por proveedor, sin valor por defecto de la empresa | Cada alta los escribe |
| Lista de precio por defecto | No existe (fase 5) | — |

## 2. Reglas del compañero

- **`app_companies`** guarda nombre, descripción y estado, más los menús que la empresa no ve
  (`app_company_disabled_menus`). Solo la edita el dueño del sistema.
- **`app_configurations`** es un **singleton por empresa** ([monedas.md §2](https://github.com/verlumyx/erp/blob/main/docs/monedas.md)):
  no se lista, no se crea a mano, no se borra ni se desactiva. Lleva:
  - `base_currency` (USD por defecto) y `secondary_currency` (VES): moneda en que lleva las cifras y moneda de
    presentación que acompaña a cada importe;
  - `rate_type` (`legal` o `manual`) y `allows_rate_override`;
  - `amount_decimals` (0–6, por defecto 2) y `price_decimals` (0–8, por defecto 6);
  - `adjustment_approval_threshold`: umbral de costo a partir del cual un ajuste pide aprobación.
- **Se crea sola**: junto con la empresa, o en el primer acceso si falta. Permisos `configuration.show` y
  `configuration.update`; una sola pantalla de edición.
- El resto de valores por defecto (bodega sugerida, lista por defecto) vive **en su maestro**, no en la
  configuración.
- El motivo de su multimoneda es legal: en Venezuela factura y pago se expresan en bolívares aunque la empresa
  lleve sus cifras en dólares.

## 3. Qué hace un ERP

Los cuatro separan lo mismo: **quién es la empresa** (datos que salen en los documentos) y **cómo trabaja**
(parámetros de cada área).

| ERP | Datos de la empresa | Parámetros |
|---|---|---|
| **Business Central** | [Company Information](https://learn.microsoft.com/en-us/dynamics365/business-central/admin-company-information): nombre, logo, contacto, banco, envío, datos fiscales; «se usa en documentos, como la cabecera de la factura» | Un *setup* singleton por área. [General Ledger Setup](https://learn.microsoft.com/en-us/dynamics365/business-central/application/base-application/table/microsoft.finance.generalledger.setup.general-ledger-setup): `LCY Code`, `Local Currency Symbol`, `Amount Decimal Places`, `Unit-Amount Decimal Places`, `Allow Posting From/To`. Además Inventory Setup y Sales & Receivables Setup |
| **Odoo** | [Companies](https://www.odoo.com/documentation/18.0/applications/general/companies.html): nombre, dirección, Tax ID, LEI, registro, moneda, teléfono, correo, web, logo, color y el diseño de los documentos | Ajustes de cada aplicación (Ventas, Inventario, Contabilidad) |
| **SAP Business One** | *Company Details*: nombre, dirección, datos fiscales. En la inicialización se fijan la [moneda local y la del sistema](https://learning.sap.com/courses/handling-accounting-in-sap-business-one/working-with-currencies-1); la local [no se cambia después](https://sap-b1-blog.com/en/sap-business-one/finance-in-sap-business-one/currencies-in-sap-business-one/) | *General Settings*: decimales (hasta 6, «solo se pueden aumentar» con movimientos), formatos |
| **ERPNext** | [Company](https://docs.frappe.io/erpnext/user/manual/en/company-setup): nombre, abreviatura, moneda por defecto, país | [System Settings](https://docs.frappe.io/erpnext/user/manual/en/system-settings) (zona horaria, formatos, precisión), [Stock Settings](https://docs.frappe.io/erpnext/user/manual/en/stock-settings) (bodega por defecto, existencia negativa, método de valuación), [Selling Settings](https://docs.frappe.io/erpnext/user/manual/en/selling-settings) (lista de precio por defecto, grupo de cliente) |

## 4. Matriz

| Valor | Sistema | Compañero | ERP | Veredicto |
|---|---|---|---|---|
| Nombre de la empresa | Sí | Sí | Sí | Coincide |
| Datos fiscales y de contacto | No | No | Los cuatro | **Hueco**: los documentos y reportes no dicen quién los emite |
| Logo | No | No (imagen de la tienda aparte) | Los cuatro | Hueco; espera a adjuntos |
| Moneda de la empresa | No | Sí, con segunda moneda y tasas | Los cuatro; fija tras movimientos (SAP) | **Hueco** |
| Multimoneda y tasas | No | Sí (motivo legal venezolano) | Los cuatro | Difiere: alcance grande, decisión aparte |
| Zona horaria | UTC fijo | No documentada | ERPNext la configura | **Hueco con defecto real** (fecha de mañana desde las 20:00) |
| Decimales de importes y precios | Fijos | Configurables | BC y SAP configurables | Difiere con motivo; configurable exige redondear en todos los documentos |
| Umbral de aprobación de ajustes | No hay aprobación | Sí | Flujos de aprobación | Pertenece a Inventario › Ajustes, no a esta fase |
| Valores por defecto de áreas (bodega, lista, plazo) | Bodega en su maestro | En su maestro | BC y ERPNext en *setups* por área | Coincide con el compañero |
| Cómo nace | — | Singleton que se crea solo | BC y ERPNext: singleton por área | — |
| Dónde se edita | — | Pantalla propia con permisos `show`/`update` | Administración o ajustes | — |

## 5. Propuesta

**Dónde vive.** En **Acceso y administración** (contexto `access`), junto a la empresa: es la misma entidad y
el mismo administrador. Otros contextos la leen por su propio puerto, como ya leen artículos o bodegas. Una
sola pantalla, «Empresa», con permisos `access.company.search` y `access.company.update`.

**Qué lleva, en dos bloques** (como los ERP):

1. **Datos de la empresa**: razón social, nombre comercial, RIF/NIF, dirección, teléfono y correo. Salen en la
   cabecera de los PDF de reportes (y de las facturas cuando se impriman). El logo espera a adjuntos.
2. **Parámetros**:
   - **Moneda de la empresa** (código ISO y símbolo), que se muestra en importes, reportes y PDF. **Fija
     cuando la empresa ya tiene documentos**, como en SAP.
   - **Zona horaria** (por defecto `America/Caracas`), de la que salen «hoy», la fecha propuesta de cada
     documento y los días de vencimiento. Corrige el defecto de UTC.

**Qué no lleva ahora, y por qué:**

- **Multimoneda con tasas**: es un módulo entero (catálogo de monedas, tasas por fecha, congelar la tasa en cada
  documento, doble importe). Cabe como tema propio, igual que listas de precio.
- **Decimales configurables**: con importes a 2 y precios a 6 fijos el sistema ya es exacto; hacerlos
  configurables obliga a redondear según la empresa en todos los documentos.
- **Umbral de aprobación de ajustes**: se decide al revisar Inventario › Ajustes, que hoy no tiene aprobación.
- **Valores por defecto de cada área** (lista de precio, plazo de pago): viven en su maestro o en su módulo,
  como hace el compañero. La lista por defecto llega con la fase 5.

## 6. Decisiones que tiene que tomar Rafael

1. **Ubicación**: en Acceso y administración (recomendado), o un contexto propio `company`.
2. **Contenido de esta fase**: datos de la empresa + moneda + zona horaria (recomendado), o también
   decimales configurables.
3. **Multimoneda con tasas** (la regla legal venezolana del compañero): tema propio para después
   (recomendado), o dentro de esta fase.
4. **Zona horaria**: corregirla en esta fase (recomendado, porque hoy propone la fecha equivocada de noche), o
   dejar UTC.

---

## 7. Decisiones de Rafael (15-sep-2026)

| Tema | Decisión |
|---|---|
| Contenido | **Todo de una vez**: datos de la empresa, moneda, zona horaria y decimales configurables («si se puede hacer todo, ¿por qué no hacerlo de una vez?») |
| Multimoneda con tasas | **En esta fase**, para no dejar cabos sueltos |
| Zona horaria | Se corrige en esta fase |
| Ubicación | Pidió la buena práctica antes de decidir (§9) |

## 8. Multimoneda: lo investigado

### 8.1 Compañero

- **Tasa** = bolívares por 1 unidad de la moneda extranjera; el bolívar no lleva tasa. Tasas por empresa, moneda,
  fecha y tipo (`legal` o `manual`), en el catálogo (`app_exchange_rates`).
- **Resolución**: la tasa del día del documento o **la última anterior** (fines de semana y feriados); nunca una
  posterior. Sin tasa, el documento no se emite.
- **Cada documento guarda** `currency` + `exchange_rate` y `base_currency` + `base_exchange_rate`: con los dos pares
  se reexpresa en bolívares y en la moneda de la empresa aunque esta cambie después.
- **Borrador** refresca la tasa; **confirmado** la congela para siempre. La factura usa la tasa de su emisión y el
  pago la de su fecha.
- **Factura y pago** guardan además `subtotal_ves`, `tax_amount_ves` y `total_ves` en la cabecera, por su valor legal.
  Pedidos y órdenes calculan el equivalente al vuelo.
- **Diferencial cambiario** (lo cobrado en bolívares contra lo facturado): previsto por el esquema, registro
  «por definir».
- **Presentación**: con doble moneda, el importe va en dos líneas solo en totales; si falta la tasa, no hay segunda línea.

### 8.2 Ley venezolana

- Con precio en divisa, la factura expresa **el equivalente en bolívares** de base imponible e impuesto y **la tasa
  del BCV** usada: Providencia SENIAT 0071, art. 13 num. 14
  ([Alliott Venezuela](https://alliottve.com/publicaciones/https-alliottve-com-precios-moneda-extranjera-comerciantes/),
  [Nayma Consultores](https://naymaconsultores.com/precios-en-moneda-extranjera-en-venezuela-que-permite-la-ley/)).
- El pago se convierte a la **tasa oficial vigente en la fecha de pago** (Ley del BCV, art. 128); la variación se
  regulariza con notas de débito o crédito.

### 8.3 ERP

| ERP | Cómo lo resuelve |
|---|---|
| Business Central | Moneda local en General Ledger Setup; [tasas por fecha de inicio](https://learn.microsoft.com/en-us/dynamics365/business-central/finance-currencies); el documento convierte con la tasa de su fecha; ganancia o pérdida realizada al pagar y no realizada al ajustar; moneda adicional de reporte |
| Odoo | [Moneda principal y monedas activadas](https://www.odoo.com/documentation/18.0/applications/finance/accounting/get_started/multi_currency.html); tasas manuales o automáticas por proveedor; moneda en cada documento; diferencias de cambio a un diario propio |
| ERPNext | [Currency Exchange](https://docs.frappe.io/erpnext/user/manual/en/currency-exchange) con fecha de validez; [proveedores automáticos](https://docs.frappe.io/erpnext/user/manual/en/currency-exchange-settings); revaluación y diferencias de cambio |

### 8.4 Qué toca en el sistema

| Contexto | Importes que hoy no tienen moneda |
|---|---|
| Inventario | Costos de ajustes, kardex y existencias (se llevan en la moneda de la empresa) |
| Compras | `unit_cost` de órdenes y entradas |
| Ventas | `unit_price` de pedidos y facturas; `subtotal`, `tax`, `total` de facturas; límite de crédito del cliente |
| Cuentas por cobrar | Monto de cobros y aplicaciones |
| Reportes | Tablero, antigüedad, estado de cuenta, ventas por cliente y valuación suman importes |

**Orden de construcción** (un paso, sus pruebas y su commit):

1. ✅ Empresa: datos, parámetros (moneda principal y secundaria, zona horaria, decimales) y la corrección de «hoy».
   Documentado en [modulos/empresa.md](../../modulos/empresa.md).
2. ✅ Monedas y tasas: tasas por fecha y tipo cargadas a mano, la serie de la empresa en sus parámetros y la
   resolución de la tasa de un documento. Documentado en [modulos/empresa.md §4](../../modulos/empresa.md#4-tasas-de-cambio--exchange_rates).
3. Compras: moneda y tasas congeladas en órdenes y entradas.
4. Ventas y cobranza: pedidos, facturas con importes en bolívares, cobros con la tasa de su fecha y el diferencial
   cambiario de cada aplicación.
5. Reportes en la moneda de la empresa, con el equivalente en la secundaria.

## 9. Ubicación: la buena práctica

- **Responsabilidades distintas.** Acceso decide quién entra, a qué empresa y con qué permisos. La configuración
  son datos de negocio que leen todos los módulos. Las guías de SaaS separan la gestión de identidad de la
  configuración de la empresa ([AWS SaaS Lens](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/identity-and-access-management.html),
  [WorkOS](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)).
- **Dirección de dependencias.** En Acceso, cada módulo de negocio dependería del de seguridad para saber la moneda o
  qué día es. En un contexto propio `company`, sin dependencias, cada módulo lo lee por un contrato publicado, como ya
  hacen compras y ventas con la existencia.
- **ERP.** Datos de la empresa en Administración; monedas y tasas en Finanzas. Sin contexto financiero, la política de
  monedas y sus tasas son más cohesivas juntas en Empresa que repartidas en el catálogo.
- **La tabla `tenants` se queda en Acceso** (identidad de la empresa); el perfil y los parámetros van 1 a 1 en
  `company`. El menú no obliga al código: una sección «Empresa» con Datos, Parámetros y Monedas y tasas.

**Recomendación:** contexto propio `company`.

**Decidido por Rafael (15-sep-2026):**

- **Contexto propio `company`** («Empresa»): datos, parámetros, monedas y tasas; los demás módulos lo leen por un
  contrato publicado.
- **Tasas cargadas a mano**, legales (BCV) o internas. La descarga automática queda fuera: el BCV no ofrece una API
  oficial estable y sería una integración que se rompe. Se puede sumar después.
