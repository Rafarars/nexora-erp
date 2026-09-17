# Empresa

**Quién** es la empresa en los documentos que emite y **cómo** trabaja: su moneda, sus tasas de cambio, su zona
horaria y sus decimales. Es la base del multimoneda, que se construye por pasos
([revisión](../revision/temas/configuracion-empresa.md#84-qué-toca-en-el-sistema)).

Contexto: `apps/api/src/contexts/company` · Pantalla: `/administracion/empresa`

| Submódulo | Tabla | Qué es |
|---|---|---|
| Datos de la empresa | `company_profiles` | Razón social, nombre comercial, RIF, dirección, teléfono y correo |
| Parámetros | `company_settings` | Moneda principal y secundaria, zona horaria, decimales de importes y precios |
| Monedas | `currencies` | Catálogo global, igual para todas las empresas; llega con las migraciones |
| Tasas de cambio | `exchange_rates` | Bolívares por 1 unidad de cada moneda, por fecha y tipo, de cada empresa |

**Por qué un contexto propio.** Acceso decide quién entra y con qué permisos; esto son datos de negocio que leen
todos los módulos. Así ningún módulo depende del de seguridad para saber la moneda o qué día es. La tabla `tenants`
sigue en Acceso; datos y parámetros van uno a uno por empresa.

---

## 1. Datos de la empresa — `company_profiles`

| Campo | Tipo | Regla |
|---|---|---|
| `legal_name` | texto(150) | Obligatorio |
| `trade_name` | texto(150) | Opcional |
| `fiscal_id` | texto(30) | Opcional; se guarda en mayúsculas (`J-40000001-2`) |
| `address` | texto(300) | Opcional |
| `phone` | texto(40) | Opcional |
| `email` | texto(150) | Opcional; tiene que ser un correo |

- **Toda empresa tiene datos.** La que nunca los llenó se presenta con el nombre con que se registró; consultar no
  escribe nada.
- Salen en la **cabecera de los reportes PDF y Excel**: razón social y RIF.
- El logo espera al módulo de adjuntos.

## 2. Parámetros — `company_settings`

| Campo | Por defecto | Regla |
|---|---|---|
| `base_currency` | `USD` | Moneda en que la empresa lleva sus cifras. Existe y está activa |
| `secondary_currency` | `VES` | La que acompaña a cada importe; vacía la apaga. Igual a la principal, tampoco hay conversión |
| `time_zone` | `America/Caracas` | Zona IANA; no se aceptan desplazamientos sueltos (`+04:00`) |
| `amount_decimals` | 2 | De 0 a 4 (el techo de la columna de importes) |
| `price_decimals` | 6 | De 0 a 6 |
| `rate_type` | `legal` | La serie de tasas con que se valoran los documentos: `legal` (BCV) o `manual` (interna) |
| `allows_rate_override` | sí | Si un documento puede llevar una tasa escrita a mano. Nunca la de la moneda de la empresa ni la del bolívar |

**Reglas**

- **Toda empresa tiene parámetros**: la que nunca los guardó lee los valores por defecto, que son la política del
  compañero para Venezuela.
- **La moneda principal no cambia con documentos confirmados** (`BaseCurrencyLockedError`): el histórico dice lo que
  dijo en su moneda, como en SAP Business One. Cuenta cualquier ajuste, orden, entrada, pedido, despacho o cobro que ya
  no sea borrador, y cualquier factura. La secundaria y la zona sí cambian.
- **Con documentos confirmados, los decimales solo suben** (`DecimalPlacesLockedError`), también como en SAP. Con
  menos decimales de importe, una factura que debe 39,60 ya no se podría cobrar entera; con menos de precio, un
  pedido escrito con 30,155 ya no se podría confirmar.
- **Qué hace cada decimal:** `amount_decimals` redondea subtotales, impuestos, totales, importes en bolívares y
  saldos en la moneda de la empresa, y limita los montos de un cobro; `price_decimals` limita los precios de los
  pedidos y los costos de las órdenes de compra (`PriceDecimalsExceededError`).
- **La moneda secundaria no cambia lo que se ve en los documentos:** la tasa y el equivalente en bolívares se
  muestran siempre, porque la ley venezolana los exige en la factura. `dual_currency` solo informa.
- Una moneda **retirada** del catálogo no se elige; la que la empresa ya tenía se conserva al guardar lo demás.

## 3. Hoy, en la zona de la empresa

El contexto publica `BusinessCalendar` (`shared/domain/ports/business-calendar.ts`): **qué día es hoy para una
empresa**. Lo usan inventario, compras, ventas, cobranza y reportes para:

- proponer la fecha de un documento que no la trae;
- rechazar una fecha futura;
- calcular vencimientos y antigüedad de saldos.

Antes era el día UTC del servidor: en Venezuela, desde las 8 de la noche, el sistema proponía la fecha de mañana. La
interfaz ya no calcula la fecha: la toma de `today` en los parámetros.

## 4. Tasas de cambio — `exchange_rates`

> **`rate` = cuántos bolívares vale 1 unidad de la moneda.** De ahí sale una sola fórmula:
> `bolívares = monto × tasa`. El cruce entre dos monedas extranjeras pasa por el bolívar
> (EUR→USD = tasa del EUR ÷ tasa del USD), sin tabla de pares.

| Campo | Tipo | Regla |
|---|---|---|
| `currency` | char(3) | Existe en el catálogo. **Nunca el bolívar**: vale siempre 1 (también un CHECK en la base) |
| `rate_date` | fecha | El día en que rige. Puede ser futuro: el BCV publica por la tarde la del día hábil siguiente |
| `type` | `legal` o `manual` | Series independientes: una no rellena los huecos de la otra |
| `rate` | decimal(18,8) | Mayor que cero, hasta 8 decimales y menos de 10.000.000 |
| `source` | texto(150) | Opcional: de dónde salió (BCV, tesorería…) |
| `is_active` | booleano | Una tasa no se borra |

**Reglas**

- **Una por moneda, fecha y tipo** en cada empresa. **Cargar otra vez la misma combinación la corrige**, y la
  reactiva si estaba desactivada. Dos cargas simultáneas de la misma: la segunda recibe un 409 y no pisa a ciegas.
- Una tasa que **no debía existir** (otra fecha, otra moneda) **se desactiva**: los documentos pasan a usar la anterior.
- Una moneda **retirada** del catálogo no recibe tasas nuevas, pero la que ya tenía se corrige.
- **Cargadas a mano.** La descarga automática del BCV queda fuera: no ofrece una API oficial estable.

**Resolución: la tasa de un día**

1. El bolívar vale 1, sin consultar nada.
2. Si no, la **activa** de esa moneda y serie con la fecha **más reciente que no pase del día**. Un sábado usa la del
   viernes; nunca una posterior.
3. Sin ninguna, el documento en esa moneda **no se emite** (`MissingExchangeRateError`, 409): mejor no emitir que
   emitir con tasa 1.

**Contrato publicado:** `DocumentRates` (`shared/domain/ports/document-rates.ts`). `forDocument(empresa, { moneda,
fecha, tasa a mano, conserva la moneda })` devuelve las dos tasas que congela un documento: la de su moneda (la de la
empresa si no dice) y la de la moneda de la empresa, de la serie que eligió en sus parámetros.

- Comprueba que la moneda exista y esté activa; un documento que **ya la tenía** la conserva aunque se haya retirado.
- Una tasa a mano solo si la empresa lo permite (`RateOverrideNotAllowedError`) y nunca para su moneda ni el bolívar
  (`FixedExchangeRateError`); la de la empresa siempre sale del catálogo.
- Los errores que cruzan contextos (`MissingExchangeRateError` y los dos anteriores) viven en el contrato. Las pruebas
  de los demás contextos usan el doble `FixedDocumentRates`.
- `amountDecimals(empresa)` y `priceDecimals(empresa)` devuelven los decimales de importe y de precio; la función
  `ensurePriceDecimals` del contrato rechaza el precio o costo que tenga más. `companyCurrency(empresa)` devuelve la
  moneda principal, que es en la que los reportes expresan sus cifras.
- Lo usan las órdenes y entradas de compra ([compras.md §2.4](compras.md#24-moneda-y-tasas)), los pedidos y facturas de
  venta ([ventas.md §2.4](ventas.md#24-moneda-y-tasas)) y los cobros
  ([cuentas-por-cobrar.md §1.5](cuentas-por-cobrar.md#15-cobrar-en-otra-moneda-y-el-diferencial-cambiario)) y los
  reportes ([reportes.md §0](reportes.md#0-la-moneda-de-los-reportes)).

## 5. API y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Consultar los datos | `GET /api/v1/company/profile` | `company.profile.search` |
| Editar los datos | `PUT /api/v1/company/profile` | `company.profile.update` |
| Consultar los parámetros | `GET /api/v1/company/settings` | Solo sesión: toda pantalla necesita moneda, decimales y hoy |
| Cambiar los parámetros | `PUT /api/v1/company/settings` | `company.settings.update` |
| Listar las monedas | `GET /api/v1/company/currencies` | Solo sesión |
| Consultar las tasas y la vigente | `GET /api/v1/company/exchange-rates` | `company.rates.search` |
| Cargar o corregir una tasa | `PUT /api/v1/company/exchange-rates` | `company.rates.record` |
| Desactivar o reactivar una tasa | `PUT /api/v1/company/exchange-rates/:rateId/status` | `company.rates.deactivate` |

La respuesta de los parámetros trae las monedas con nombre, símbolo y decimales, si hay doble moneda (`dualCurrency`)
y el día de hoy (`today`).

La consulta de tasas filtra por `currency`, `type`, `from` y `to`, trae las 500 más recientes y, en `current`, la tasa
que usaría un documento de `date` (hoy de la empresa si no viene) en cada moneda extranjera activa, de la serie
pedida o de la que usa la empresa.

## 6. Pantalla

`/administracion/empresa`, tercera sección de Administración:

- **Datos de la empresa** y **Parámetros**, cada uno con su formulario. Quien no puede editar los ve en solo lectura.
- La zona horaria se elige de la lista IANA del servidor; las monedas, de las activas más la que ya tiene.
- Administración aparece en el menú de la cuenta también a quien solo puede ver o cambiar la empresa, y entra por la
  primera sección que el rol puede ver.

`/administracion/tasas`, cuarta sección de Administración (**Tasas de cambio**):

- Arriba, las **vigentes hoy** de cada moneda para la serie de la empresa, con el día de la tasa si es anterior.
- El listado con filtros por moneda, tipo y fechas. **Cargar tasa** abre un panel lateral y cada fila ofrece
  **Corregir** y **Desactivar** o **Reactivar**, según el rol. La tasa se escribe con coma decimal.
- En **Parámetros**, «Tasa de los documentos» elige la serie legal o interna, y «Tasa escrita a mano en un documento»
  si se permite.

## 7. Datos de demostración

| Empresa | Razón social | RIF | Parámetros |
|---|---|---|---|
| Acme | Acme Industrial, C.A. | J-40000001-2 | USD y VES, Caracas, 2 y 6 decimales |
| Globex | Globex Servicios, C.A. | J-40000002-0 | Igual |
| Initech | Initech Logística, C.A. | J-40000003-9 | Igual |
| Volumen | Volumen Distribuciones, C.A. | J-40000004-7 | Igual |

Se reescriben en cada corrida de semillas. Las monedas (USD, EUR, VES) llegan con la migración.

Tasas: las cuatro empresas tienen la legal del dólar del **1 de enero de 2026** (Acme también la del euro), para que
cualquier documento del año tenga tasa. En septiembre, Acme tiene la legal del dólar (días 1, 8 y 11), la del euro
(1 y 11) y una interna del dólar; Globex, la legal del dólar del día 10, que es la que atacan las pruebas de
aislamiento.

## 8. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio y aplicación | `contexts/company/**/*.spec.ts` | Valores por defecto, zona horaria (22:00 de Caracas sigue siendo hoy), monedas activas, moneda principal fija y decimales que solo suben con documentos |
| Contrato | `company-ports.contract.ts` | Datos y parámetros por empresa, catálogo de monedas, nombre registrado y documentos confirmados, contra doble y PostgreSQL |
| API | `tests/api/company.api.spec.ts` | Lectura por cualquier miembro, cambios y sus rechazos, moneda fija y decimales que no bajan en Acme, permisos y sesión |
| Interfaz | `tests/ui/company.spec.ts` | Editar los datos, error en español, solo lectura |
| Dominio y aplicación | `domain/rate/*.spec.ts`, `application/exchange-rates.spec.ts` | Tasa válida, bolívar sin tasa, corregir en lugar de duplicar, la del día o la anterior y nunca una posterior, serie de la empresa, tasas de un documento |
| Contrato | `company-ports.contract.ts` | Guardar, clave única, la última activa hasta un día y el listado con filtros, contra doble y PostgreSQL |
| API | `tests/api/exchange-rates.api.spec.ts` | Resolución, corrección, desactivar y reactivar, rechazos, solo lectura y sesión |
| Interfaz | `tests/ui/exchange-rates.spec.ts` | Cargar con coma decimal, corregir desde la fila, errores en español, filtros y solo lectura |
| Aislamiento | `support/isolation-matrix.ts` | Desactivar una tasa de otra empresa responde 404 |
