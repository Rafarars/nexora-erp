# Empresa

**Quién** es la empresa en los documentos que emite y **cómo** trabaja: su moneda, su zona horaria y sus
decimales. Es la base del multimoneda, que se construye por pasos
([revisión](../revision/temas/configuracion-empresa.md#84-qué-toca-en-el-sistema)).

Contexto: `apps/api/src/contexts/company` · Pantalla: `/administracion/empresa`

| Submódulo | Tabla | Qué es |
|---|---|---|
| Datos de la empresa | `company_profiles` | Razón social, nombre comercial, RIF, dirección, teléfono y correo |
| Parámetros | `company_settings` | Moneda principal y secundaria, zona horaria, decimales de importes y precios |
| Monedas | `currencies` | Catálogo global, igual para todas las empresas; llega con las migraciones |

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

**Reglas**

- **Toda empresa tiene parámetros**: la que nunca los guardó lee los valores por defecto, que son la política del
  compañero para Venezuela.
- **La moneda principal no cambia con documentos confirmados** (`BaseCurrencyLockedError`): el histórico dice lo que
  dijo en su moneda, como en SAP Business One. Cuenta cualquier ajuste, orden, entrada, pedido, despacho o cobro que ya
  no sea borrador, y cualquier factura. La secundaria, la zona y los decimales sí cambian.
- Una moneda **retirada** del catálogo no se elige; la que la empresa ya tenía se conserva al guardar lo demás.

## 3. Hoy, en la zona de la empresa

El contexto publica `BusinessCalendar` (`shared/domain/ports/business-calendar.ts`): **qué día es hoy para una
empresa**. Lo usan inventario, compras, ventas, cobranza y reportes para:

- proponer la fecha de un documento que no la trae;
- rechazar una fecha futura;
- calcular vencimientos y antigüedad de saldos.

Antes era el día UTC del servidor: en Venezuela, desde las 8 de la noche, el sistema proponía la fecha de mañana. La
interfaz ya no calcula la fecha: la toma de `today` en los parámetros.

## 4. API y permisos

| Acción | Ruta | Permiso |
|---|---|---|
| Consultar los datos | `GET /api/v1/company/profile` | `company.profile.search` |
| Editar los datos | `PUT /api/v1/company/profile` | `company.profile.update` |
| Consultar los parámetros | `GET /api/v1/company/settings` | Solo sesión: toda pantalla necesita moneda, decimales y hoy |
| Cambiar los parámetros | `PUT /api/v1/company/settings` | `company.settings.update` |
| Listar las monedas | `GET /api/v1/company/currencies` | Solo sesión |

La respuesta de los parámetros trae las monedas con nombre, símbolo y decimales, si hay doble moneda (`dualCurrency`)
y el día de hoy (`today`).

## 5. Pantalla

`/administracion/empresa`, tercera sección de Administración:

- **Datos de la empresa** y **Parámetros**, cada uno con su formulario. Quien no puede editar los ve en solo lectura.
- La zona horaria se elige de la lista IANA del servidor; las monedas, de las activas más la que ya tiene.
- Administración aparece en el menú de la cuenta también a quien solo puede ver o cambiar la empresa, y entra por la
  primera sección que el rol puede ver.

## 6. Datos de demostración

| Empresa | Razón social | RIF | Parámetros |
|---|---|---|---|
| Acme | Acme Industrial, C.A. | J-40000001-2 | USD y VES, Caracas, 2 y 6 decimales |
| Globex | Globex Servicios, C.A. | J-40000002-0 | Igual |
| Initech | Initech Logística, C.A. | J-40000003-9 | Igual |
| Volumen | Volumen Distribuciones, C.A. | J-40000004-7 | Igual |

Se reescriben en cada corrida de semillas. Las monedas (USD, EUR, VES) llegan con la migración.

## 7. Pruebas que lo protegen

| Nivel | Dónde | Qué cubre |
|---|---|---|
| Dominio y aplicación | `contexts/company/**/*.spec.ts` | Valores por defecto, zona horaria (22:00 de Caracas sigue siendo hoy), monedas activas, moneda principal fija con documentos |
| Contrato | `company-ports.contract.ts` | Datos y parámetros por empresa, catálogo de monedas, nombre registrado y documentos confirmados, contra doble y PostgreSQL |
| API | `tests/api/company.api.spec.ts` | Lectura por cualquier miembro, cambios y sus rechazos, moneda fija de Acme, permisos y sesión |
| Interfaz | `tests/ui/company.spec.ts` | Editar los datos, error en español, solo lectura |
