# Mejoras futuras

Ideas y decisiones diferidas. **Nada de esto se construye hasta que exista la
necesidad real** — pero queda anotado con su razonamiento para no perderlo.

Cada entrada dice *qué*, *por qué* y *qué habría que hacer*.

---

## Producto

### Exponer la API a integraciones de terceros

**Por qué:** un sistema externo podría registrar órdenes de compra o facturas
directamente en el ERP.

**El diseño ya lo permite:** los casos de uso no conocen HTTP, así que exponerlos es
añadir un adaptador de entrada, no reestructurar. Y como el `TenantId` es obligatorio
en la firma de los puertos, un integrador no puede tocar datos de otra empresa ni por
accidente.

**Decisión tomada (09-sep-2026): una sola API, diseñada como pública desde el primer
día.** No habrá una superficie interna y otra pública: sería duplicación especulativa,
y la pública terminaría mal probada. El frontend propio es el primer cliente de la API,
que es lo que la mantiene viva y correcta.

Por eso, desde ya: rutas versionadas, DTOs en vez de entidades de dominio, y formato de
error consistente. Abrirla luego será un problema de autenticación y documentación, no
de arquitectura.

**Lo que faltaría el día que se abra:**
- Autenticación de máquina (claves de API o credenciales de cliente) **atadas a una empresa**
- Límite de peticiones
- **Idempotencia**: si un integrador reintenta tras un corte de red, no puede duplicar
  una orden de compra. Es un problema contable, no técnico
- Documentación del contrato (OpenAPI)

### Backend for Frontend

**Cuándo aparecería:** cuando una pantalla necesite datos de varias entidades juntas.
Un endpoint a la medida de una pantalla ensucia un contrato público.

**Cómo:** una capa delgada que compone llamadas para la interfaz, **sin duplicar
lógica**, apoyándose en los mismos casos de uso. Se añade cuando el problema exista.

### Extraer un manual de arranque reutilizable

**Por qué:** este proyecto está estableciendo un método —fases, convenciones, reglas de
calidad— que **no depende del stack**. La idea es poder decir *"quiero arrancar un
proyecto con Laravel y Vue"* y que cualquier asistente sepa qué hacer y en qué orden.

**Dos capas, no una:**

| Capa | Contenido | ¿Cambia con el stack? |
|---|---|---|
| **Método** | Fases, principios y puertas de calidad | **No** |
| **Stack** | Sintaxis, comandos y librerías | Sí |

Lo que transfiere: CI desde el día uno antes que las funcionalidades; el repositorio
debe reconstruirse solo; fallar en cerrado; explícito sobre automático; verificar que
las guardas saltan, no solo que el camino feliz funciona; el código derivado se
regenera con enganches; ningún secreto en el repositorio y configuración validada al
arrancar; un comando que reproduzca el CI; autorización que deniega por defecto.

**Estado (09-sep-2026): creado** en `github.com/Rafarars/engineering-playbook`, con el
método del H0 ya probado (arranque, puertas de calidad, diagnóstico, plantillas y notas
del stack). La carpeta `patterns/` está vacía a propósito: los patrones de arquitectura
se extraen **al cerrar el H1**, cuando estén construidos y no solo escritos.

**Criterio de reparto:** el playbook guarda el **patrón**; cada proyecto guarda su
**instancia**. `docs/ARCHITECTURE.md` se queda aquí porque quien abra este repositorio no
debería tener que ir a otro para entender la arquitectura.

**Pendiente:** exponerlo también como skill invocable, sincronizada a `~/.claude/skills/`
y `~/.gemini/skills/`.

**Límite honesto:** un manual hace reproducibles el andamiaje, las convenciones y las
puertas de calidad. **No** convierte una instrucción en un ERP: el modelado del dominio
sigue exigiendo pensar.

### Permiso de plataforma

Crear una empresa no pertenece a ninguna empresa: es una operación de otro alcance. En
el H1 se resuelve con la semilla. Cuando haga falta un endpoint, será un permiso de
plataforma explícito, nunca un `if` que salte el guardián de inquilino.

---

### ERP completo: lo que quedó fuera del flujo mínimo

**Por qué:** el H2–H7 cubre el ciclo comprar → recibir → vender → despachar → facturar →
cobrar. Un ERP de uso real necesita más, y la documentación de referencia
(github.com/verlumyx/erp, `docs/`) ya lo tiene especificado. Decidido el 13-sep-2026:
queda para cuando se decida completar el ERP.

**Qué habría que hacer, agrupado:**
- **Fiscal y moneda:** identificación fiscal (RIF), multimoneda con tasas de cambio por fecha
  copiadas al confirmar y diferencial cambiario, retenciones de impuestos
- **Trazabilidad:** lotes con vencimiento (salida FEFO), números de serie, ubicaciones dentro
  de la bodega
- **Logística:** traslados entre bodegas, rutas de reparto, importaciones con costos de
  internación
- **Documentos financieros:** notas de crédito, anticipos, devoluciones de compra y de venta,
  cuentas por pagar y pagos a proveedores, listas de precio
- **Tienda en línea** con pedidos web que se convierten en pedidos de venta

**El diseño ya lo permite:** cada grupo es un contexto nuevo o una extensión de uno existente,
y la regla de que solo entrada, despacho y ajuste mueven stock hace que traslados y devoluciones
se monten sobre documentos que ya existirán.

### Paginación de los listados del catálogo

**Por qué:** los cinco listados devuelven todo. Con un catálogo de miles de artículos, la
tabla y la respuesta crecen sin límite.

**Qué habría que hacer:** búsqueda y paginación en el puerto (`search(tenantId, criteria)`),
y la guarda de rendimiento prevista en el H7 sobre un listado con volumen sembrado.

### Paginación de compras

**Por qué:** los listados de órdenes y entradas traen todo, y la de entradas carga las órdenes y
los proveedores de la empresa para resolver nombres.

**Qué habría que hacer:** paginar por código y resolver solo lo que la página muestra.

### Paginación del kardex y de los ajustes

**Por qué:** el kardex de un artículo con años de movimientos, o el listado de ajustes de una
empresa grande, se devuelven enteros.

**Qué habría que hacer:** paginar por `sequence` en el kardex y por código en los ajustes, y
la guarda de rendimiento del H7.

### Ventas: lo que quedó fuera del H5

**Por qué:** el H5 cierra vender → despachar → facturar. Lo demás cabe sobre lo construido.

**Qué habría que hacer:**
- **Avisar cuando un ajuste de salida deja pedidos sin existencia**: hoy el ajuste se aplica sin mirar
  las reservas (a propósito: registra algo que ya pasó) y el despacho falla después con un mensaje
  claro. La mejora es avisar al confirmar el ajuste qué pedidos quedan afectados, sin bloquearlo.
  Explicado en `modulos/inventario.md` §1.0.1
- **Motivo obligatorio en los ajustes** (conteo inicial, conteo, merma, daño, hallazgo), para saber
  para qué se usó cada uno y sacar reportes de mermas
- **Devoluciones de venta y notas de crédito**
- **Listas de precio y descuentos**; hoy el precio se escribe en cada pedido
- **Vender servicios**, que no salen de bodega
- **Facturar varios despachos en una factura**, o un pedido entero
- **Pasar el ciclo completo a Gherkin** con `playwright-bdd`, si se aprueba la herramienta

### Cuentas por cobrar: lo que quedó fuera del H6

**Por qué:** el H6 cierra facturar → cobrar con saldo, vencidas y crédito. Lo demás cabe encima.

**Qué habría que hacer:**
- **Anticipos y pagos de más**: hoy el importe de un cobro es la suma de lo que aplica a facturas
- **Notas de crédito** que bajen el saldo sin dinero (devoluciones, descuentos posteriores)
- **Avisar del crédito en el pedido**: hoy se frena al facturar, que es cuando nace la deuda
- **Días de gracia** antes de bloquear por vencidas, e **intereses de mora**
- **Recibo de cobro** imprimible y estado de cuenta en PDF (encaja con el H7)
- **Multimoneda** en cobros y facturas
- **Paginación** de cobros y facturas por cobrar, y la guarda de rendimiento del H7
- **Guardar lo cobrado en la base con un `CHECK`** si el volumen hiciera caro sumar cobros: hoy lo
  protege el bloqueo de las facturas

### Compras: lo que quedó fuera del H4

**Por qué:** el H4 cierra comprar → recibir con proveedor, orden y entrada. Un área de compras real
pide más, y todo cabe sobre lo construido. Decidido con Rafael al aprobar el alcance (13-sep-2026).

**Qué habría que hacer:**
- **Cuentas por pagar**: factura de proveedor contra la entrada, vencimiento con el plazo del
  proveedor y pagos. Es un contexto propio
- **Devoluciones a proveedor**: un documento que saca existencia citando la entrada
- **Aprobación de órdenes por monto** antes de confirmar
- **Costos adicionales** (flete, seguro, importación) prorrateados sobre el costo de la entrada
- **Cierre corto**: dar una orden por terminada aunque falte mercancía, para que deje de estar en
  camino
- **Comprar servicios**, que no pasan por bodega
- **Proteger la bodega que tiene órdenes abiertas**: hoy se puede desactivar una bodega con mercancía
  en camino y la entrada falla al confirmar. El artículo ya está protegido desde la revisión de
  Artículos; la bodega se resuelve al revisar Bodegas
- Que la fecha de una entrada no pueda ser anterior a la de su orden

### Renombrar `AccessError` a `ApiError` en el frontend

**Por qué:** el catálogo lo reutiliza como error de la API. El nombre ya no dice lo que es.

**Qué habría que hacer:** moverlo a `modules/shared/` con su traducción base, y que cada
módulo añada sus códigos.

### Multimoneda: lo que la revalidación del 17-sep-2026 dejó fuera

Detalle y fuentes en [revision/temas/configuracion-empresa.md §10](revision/temas/configuracion-empresa.md#10-revalidación-17-sep-2026).

- **IGTF (3 %)** sobre pagos en divisas, que perciben los contribuyentes especiales. **Por qué:** es obligatorio para
  ellos. **Cómo lo haría el mercado** (investigado, ver el tema §10.5): **en el cobro**, no en la factura, como el
  módulo venezolano de Odoo, la propuesta de la OCA, Profit Plus, SAINT y eFactory. **Qué haría falta:** una marca de
  contribuyente especial en los parámetros de la empresa; una forma de pago en divisas; el 3 % calculado sobre lo
  cobrado, expresado en bolívares a la tasa del día del cobro, contra un pasivo «IGTF por enterar» cuando exista
  contabilidad; y el aviso del 3 % impreso en la factura. La norma no dice cómo documentarlo cuando el cobro llega
  después de la factura: las opciones discutidas son factura complementaria, nota de débito o comprobante de
  percepción.
- **Notas de débito y crédito**, también por el diferencial cambiario (Reglamento LIVA art. 51). **Por qué:** es como
  se regulariza la variación cuando el contrato tiene cláusula de ajuste. **Qué haría falta:** documento propio con
  referencia a la factura, sus importes en bolívares y su efecto en el saldo.
- **Base e IVA en bolívares por alícuota**, con el IVA en bolívares calculado sobre la base convertida. **Por qué:** la
  Providencia 0071 pide el desglose en el documento fiscal; hoy solo se guardan los totales y el IVA se convierte ya
  redondeado. **Qué haría falta:** importes en bolívares por línea o por alícuota al emitir.
- **Documento fiscal impreso o digital** (Providencia 0071 o SNAT/2024/000102). **Qué haría falta:** numeración de
  control, datos de imprenta o proveedor autorizado y el PDF de la factura.
- **Diferencial cambiario en la moneda de la empresa** y **revaluación de saldos abiertos**. **Por qué:** los ERP
  registran la ganancia o pérdida realizada en la moneda contable y ajustan lo pendiente a la tasa del día; una factura
  en bolívares de una empresa en dólares hoy da diferencial 0 aunque pierda valor. **Qué haría falta:** la
  contabilidad.
- **Decimales por moneda y tolerancia al aplicar cobros** (como *Application Rounding Precision* de Business Central).
- **La web formatea importes con 2 a 4 decimales fijos**, no con los de la empresa. **Qué haría falta:** pasar los
  parámetros a cada tabla o un formateador por sesión.
- **Tasa a mano en la factura.** El compañero la admite si la empresa lo permite, y Odoo 18 y ERPNext dejan editarla;
  aquí no, porque la ley pide la tasa oficial. Se reabre si una empresa factura con una convención especial.
- **Heredar la tasa del despacho.** La factura usa la tasa de su emisión, como el compañero y los cuatro ERP. Si
  alguien factura días después de entregar, el hecho imponible fue la entrega: SAP Business One resuelve eso con una
  opción para copiar la tasa del documento base. **Qué haría falta:** un parámetro de empresa y que la emisión pida la
  tasa de la fecha del despacho.

### Listas de precio: lo que la fase 5 dejó fuera

Detalle y fuentes en [revision/temas/listas-de-precio.md](revision/temas/listas-de-precio.md).

- **Vigencia por fechas de un precio.** Hoy hay un solo precio por artículo y lista, como el ERP del compañero: el
  histórico vive en los documentos emitidos, que congelan su precio. **Por qué haría falta:** cargar en diciembre la
  lista que entra en enero, sin tocarla ese día. **Cómo lo hacen:** ERPNext (`Valid From` / `Valid Upto`), Business
  Central y Odoo lo llevan en la línea; SAP lo separa en *Special Prices*. **Qué haría falta:** varias filas por
  artículo y lista, resolución por la fecha del documento y una validación que impida solapes.
- **Precio distinto por unidad de medida.** Hoy el precio es por unidad base y se multiplica por el factor, así que
  una caja de doce cuesta exactamente doce piezas. **Por qué haría falta:** en mayoreo la caja suele costar menos que
  la suma de sus piezas. **Cómo lo hacen:** ERPNext ata cada `Item Price` a una unidad («A price is always specific to
  a certain UOM»). **Qué haría falta:** la unidad en la clave de `item_prices` y decidir qué pasa cuando falta la de
  la unidad elegida.
- **Cantidad mínima y descuentos por volumen.** Ni el compañero ni nosotros los tenemos; Odoo, Business Central y SAP
  sí. **Qué haría falta:** una cantidad mínima en la línea de precio y elegir la fila que aplica según la cantidad.
- **Margen mínimo sobre el costo**, en vez o además del precio mínimo fijo. **Por qué:** es lo que hacen los ERP —SAP
  calcula la ganancia bruta y dispara una aprobación, Odoo permite un piso de margen en la regla de precio y ERPNext
  avisa si el precio de venta baja del de compra—, y un piso atado al costo se ajusta solo cuando el costo sube. **Se
  descartó** porque un artículo recién creado, o sin compras todavía, tiene costo cero y cualquier margen lo
  rechazaría. **Qué haría falta:** un porcentaje por artículo o de la empresa, y leer el costo promedio de la bodega
  del pedido (que ya está en la moneda de la empresa).
- **Descuento por cliente y por línea.** El compañero tiene un `discount_percent` fijo por cliente y un descuento por
  documento. Aquí el descuento se ve restando `list_price` menos `unit_price`, pero no se declara como tal. **Qué
  haría falta:** un campo de descuento que se aplique al precio sugerido y quede escrito en la línea.
- **Listas de precio de compra.** La orden de compra sigue con el costo escrito a mano. **Cómo lo hacen:** Business
  Central, ERPNext y SAP usan el mismo objeto marcado como de compra; Odoo lo separa en la ficha del producto. **Qué
  haría falta:** una marca de venta o compra en la lista y resolver el costo sugerido en la orden.
- **`price_decimals` admite hasta 8 pero las columnas de precio guardan 6.** Una empresa que configure 7 u 8 no verá
  esos decimales en un precio guardado. **Qué haría falta:** ampliar las columnas a `decimal(18,8)` o limitar el
  parámetro a 6.

### Servicios: lo que la fase 6 dejó fuera

- **Tipo «no inventariado»**, además de servicio. El compañero tiene cuatro tipos (`inventoried`, `non_inventoried`,
  `service`, `serialized`) y trata igual al servicio y al no inventariado: ninguno mueve existencia. **Qué haría
  falta:** un valor más en el tipo del artículo; la regla de `moves_stock` ya cubriría el resto.
- **Facturar el pedido por partes sin despacho.** Hoy un pedido de solo servicios se factura entero de una vez. **Qué
  haría falta:** elegir qué líneas y cuánto de cada una entra en la factura, como el `invoiceable-lines` del compañero.
- **Cerrar el pedido cuando todo está despachado *y* facturado.** El compañero tiene un estado `completed` que exige
  las dos cuentas al 100 %; aquí el pedido queda en «despachado» aunque falte facturar. **Qué haría falta:** un estado
  más y recalcularlo también al emitir y al anular una factura.
- **Anular una factura devuelve lo facturado al pedido.** Hoy anular deja la cuenta `invoiced_quantity` como estaba, así
  que un servicio ya facturado no se vuelve a ofrecer aunque su factura se anule. **Qué haría falta:** descontar al
  anular, con el pedido bloqueado.

### Selectores que buscan contra el servidor

**Por qué:** los formularios de ajustes, órdenes y pedidos cargan hasta 50 artículos para su selector. El maestro ya
se lista paginado y filtrado, pero un catálogo de miles necesita un selector que consulte mientras se escribe, como
el `lookup` del ERP del compañero (`docs/selects-remotos.md`).

**Qué haría falta:** un endpoint de búsqueda que devuelva `{value, label}` con un tope pequeño, hidratación de lo ya
elegido por id, y un componente de selector con búsqueda.

## Infraestructura y despliegue

### Comandos de despliegue en el Makefile

`make deploy-*` para Supabase, Render y Vercel. **No se escriben antes de configurar
esas plataformas**: serían comandos inventados contra servicios que no existen.

### Entornos de vista previa por rama

Una base de datos y un despliegue por cada pull request, para que un revisor pruebe una
rama sin tocar nada más. Vercel y Supabase lo permiten.

### Observabilidad

`@nestjs/observe` u OpenTelemetry: trazas, métricas y tiempos por petición. Se descartó
en el H0 por no tener sistema que observar ni recolector a donde enviar.

---

## Requisitos del despliegue

No son mejoras lejanas: **hay que resolverlos antes o durante el primer despliegue**,
porque el enlace del portafolio depende de ellos.

### Límite de peticiones

Se despliega en planes gratuitos, que tienen cuota. Un bot rastreador o un integrador
con un bucle mal escrito puede **agotarla**, y entonces el enlace del CV cae justo el
día que un reclutador lo abre. No cuesta dinero, cuesta un módulo y unas líneas.

### Mantener los servicios despiertos

| Plataforma | Comportamiento |
|---|---|
| Render (gratis) | Se duerme tras **15 min** sin peticiones; despertar tarda ~1 min |
| Supabase (gratis) | Pausa el proyecto tras inactividad; reactivarlo es **manual** |
| Vercel | No se duerme |

**Render da 750 horas de instancia al mes por espacio de trabajo, y un mes tiene ~730.**
Mantener un servicio despierto 24/7 consume casi toda la bolsa y deja ~20 horas de
margen: cualquier segundo servicio la agota y el servicio queda **suspendido**, no solo
lento.

Plan: **ping por ventana horaria, no 24/7.** Cada 10 minutos entre las 7:00 y las 23:00
son unas 490 h/mes, con ~260 h de colchón. Fuera de esa franja se acepta el arranque en
frío — a las tres de la mañana no hay reclutadores mirando.

Para Supabase basta un ping diario para evitar la pausa del proyecto.

El cron puede vivir en un workflow programado de GitHub Actions (gratis en repos
públicos), recordando que **esos workflows se desactivan solos tras ~2 meses sin
actividad en el repositorio**.

> **Red de seguridad ya existente:** el entregable principal es el reporte de CI en
> GitHub Pages, que es estático y nunca se duerme. Aunque el ping falle o se agoten las
> horas, el enlace del CV sigue vivo. La app desplegada es el bonus.

### Verificar las cuotas reales antes de desplegar

Las condiciones de los planes gratuitos cambian seguido. **Consultar la documentación
oficial de Render, Supabase y Vercel en el momento del despliegue**, no fiarse de estas
notas.

## Calidad y seguridad

### Fijar las imágenes por huella digital

`gitleaks` está fijado por etiqueta (`v8.18.4`). Una etiqueta puede reapuntarse a otra
imagen; una huella (`@sha256:...`) no. Es la diferencia entre "la versión 8.18.4" y
"exactamente estos bytes". Razonable para un portafolio; obligatorio donde haya
requisitos estrictos de cadena de suministro.

### Reducir el tamaño de la imagen de la API

308 MB, de los cuales `@prisma/client` pesa 71 MB. Se podría bajar empaquetando la
aplicación en un solo archivo, pero complica el diagnóstico de errores y el retorno es
marginal.

---

## Deuda técnica

### Alinear las versiones de TypeScript

`apps/api` usa TypeScript 6 y `apps/web` la 5.9. Sin conflictos hoy. Conviene alinearlas
al crear `packages/contracts` con los tipos compartidos.

### Evaluar el React Compiler

Se descartó en el H0 para que React se comportara como describe la documentación
mientras se aprende, y para no meter un optimizador automático antes de escribir la
guarda de rendimiento. Se activa con una línea en `next.config.ts` cuando el sistema
esté maduro.

## Seguridad: lo que la revisión del H0 y el H1 dejó anotado

**Revocar tokens al cerrar sesión.** Hoy cerrar sesión borra la cookie, pero el token
sigue siendo válido hasta que caduca (una hora). El riesgo es bajo: la cookie es
`httpOnly` y el guardián consulta la base en cada petición, así que desactivar a alguien
corta el acceso al instante. Haría falta una lista de tokens revocados, o tokens cortos
con renovación.

**Límite de intentos compartido entre instancias.** El contador de intentos fallidos vive
en la memoria del proceso. Con varias instancias de la API, cada una contaría por su lado
y el límite real se multiplicaría. Haría falta un almacén común, como Redis.

**HSTS.** No se envía desde la aplicación: en local se sirve por HTTP y quedaría grabado
en el navegador para `localhost`. Debe ponerlo el proxy que termina TLS en el servidor.

**CSP con `script-src`.** La del frontend cierra el encuadre, los plugins y el destino de
los formularios, pero no restringe scripts, porque Next inyecta scripts en línea. Exigirlo
pide un nonce por petición desde el middleware.

## Cambio de correo: lo que falta para producción

**Verificar el correo nuevo.** Hoy se cambia al confirmar la contraseña, sin comprobar que
el buzón nuevo es de la persona. Un error de tecleo la deja sin poder recuperar la cuenta.
Haría falta enviar un enlace de confirmación y no aplicar el cambio hasta que se abra.

**La unicidad del correo ante una carrera.** El caso de uso comprueba que el correo esté
libre antes de guardar, y la base tiene un índice único. Si dos personas piden el mismo
correo a la vez, la segunda choca con el índice y responde 500. Habría que traducir el
error de clave única del ORM a `EmailAlreadyInUseError` en el adaptador.

**Limitar los intentos de contraseña actual.** Cambiar el correo o la contraseña pide la
actual, pero no cuenta los fallos como el inicio de sesión. Exige una sesión abierta, así
que el riesgo es bajo, pero quien la encuentre podría probar contraseñas sin límite.

### Reportes: lo que quedó fuera del H7

**Por qué:** el H7 cubre el tablero y los reportes que el ciclo ya genera. Lo demás es de un ERP
completo o de más volumen.

**Qué habría que hacer:**
- **Reportes configurables** por el usuario (vistas guardadas, columnas elegidas) y **envío programado**
  por correo: las tablas que propone `verlumyx/erp` en `docs/reportes.md` §3
- **Exportaciones en cola** con aviso al terminar, cuando un reporte tarde más de lo razonable
- **Gráficas** en el tablero y comparativo de periodos (mes contra mes)
- **Más reportes**: kardex por artículo, compras por proveedor, cobros realizados, margen de utilidad
- **Recibo de cobro** imprimible
- **Logo y datos fiscales** de la empresa en el encabezado de los PDF
- **Leer con una réplica** de solo lectura si los reportes cargan la base principal
