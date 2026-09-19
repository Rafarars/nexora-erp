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

### Métodos de costo distintos del promedio ponderado

**Por qué:** el inventario se valora con **promedio ponderado, y solo con ese**. El sector ofrece
elegir: Odoo tiene estándar, AVCO y FIFO; ERPNext, FIFO, promedio móvil y LIFO.

**Decidido en la revisión del Kardex (19-sep-2026): se queda el promedio.** Dos razones, y la
segunda salió de leer el código del sistema de referencia:

1. **FIFO no es un campo, es otro motor.** Exige capas: cada entrada es una capa con su costo y su
   cantidad restante, las salidas consumen capas en orden, y una anulación tiene que *des-consumir*
   las capas que tocó, en el orden inverso. Nada de eso cabe en el promedio, que es un único número
   por artículo y bodega.
2. **La referencia declara tres métodos y tiene uno y medio.** Su artículo lleva
   `cost_method` con `['average', 'fifo', 'standard']`, pero ese campo **se lee en exactamente dos
   sitios**, los dos comparándolo con `'standard'` para elegir entre `standard_cost` y
   `average_cost` al calcular el costo de venta de una factura. **`fifo` no ramifica en ninguna
   parte**: se puede elegir y el motor sigue calculando promedio ponderado. Ofrecer una opción que
   no hace lo que promete es peor que no ofrecerla; es el mismo caso que su retención, y se
   descartó por el mismo motivo.

**Qué haría falta:** una tabla de capas de costo, el consumo en orden con su bloqueo, la reversión
que devuelve las capas, y decidir si el método se elige por artículo o por categoría. Se construye
cuando haya una necesidad real, no para igualar una lista de características.

### Paginación del kardex

**Por qué:** el kardex de un artículo con años de movimientos se devuelve entero.

**Hecho el 19-sep-2026**, en la revisión del módulo: el kardex pagina y filtra por bodega, por tipo
de documento y por rango de fechas, y el listado de ajustes y el de existencias también. Queda
pendiente **la guarda de rendimiento del H7** sobre un artículo con miles de movimientos: la empresa
de volumen tiene facturas, no kardex.

### El buscador queda encima del título en los listados con `CatalogTable`

**Por qué:** en Artículos —y en los demás listados que usan `CatalogTable`— el buscador y el contador
de resultados se pintan **antes** del título de la sección, así que la pantalla empieza por la
herramienta y no por lo que es. En Ajustes, que no usa ese componente, el orden es el natural:
título, filtros, tabla. Lo vio la revisión de la interfaz a mano de Ajustes (19-sep-2026).

**Qué haría falta:** que `CatalogTable` acepte una franja de herramientas debajo de su cabecera, y
mover ahí el buscador de cada listado. Toca Catálogo, Inventario, Compras y Ventas a la vez, que es
justo por lo que no se hizo sobre la marcha.

### Cerrar la carrera entre desactivar una bodega y publicar en ella

**Por qué:** el Catálogo construyó la regla «una bodega no se desactiva si tiene existencia o
documentos abiertos». Bajo concurrencia se puede romper: `WarehouseStatusChanger` pregunta la
existencia **fuera de toda transacción y sin bloquear la bodega**
(`change-warehouse-status/warehouse-status-changer.ts:36-44`), y la publicación de un ajuste, una
entrada o un despacho **no bloquea ni revisa la bodega** dentro de su transacción: la comprueba
antes, al revalidar el borrador (`adjustment-line-factory.ts:44`). Interleadas, una bodega vacía se
desactiva mientras un ajuste le mete existencia, y queda **una bodega inactiva con mercancía
dentro** — el estado que la regla existía para impedir.

Encontrado leyendo la persistencia durante la revisión de Ajustes (19-sep-2026). Ventana estrecha y
sin impacto conocido, pero es una invariante que el sistema dice mantener.

**Qué haría falta, en dos mitades:**
1. En el inventario: bloquear la fila de la bodega en modo compartido dentro de `lockedLedger`
   —donde ya se bloquean los artículos— y comprobar ahí que sigue activa. Es **un solo sitio**: los
   tres documentos que mueven existencia pasan por ahí.
2. En el catálogo: envolver la desactivación en una transacción que bloquee la bodega con
   `FOR UPDATE` antes de preguntar por la existencia y los documentos abiertos.

Con las dos, las dos operaciones se serializan: o la desactivación ve la existencia, o la
publicación ve la bodega cerrada. Con una sola, la ventana se estrecha pero no se cierra.

### Contrapartida contable de los movimientos de inventario

**Por qué:** el sistema no lleva contabilidad, así que un ajuste mueve existencia y no dice contra
qué cuenta va. La investigación del sector durante la revisión de Ajustes (19-sep-2026) encontró que
eso es justo lo que **cinco de seis** productos exigen —ERPNext con su `Difference Account`, Business
Central con `Inventory Adjmt.`, SAP con el *Inventory Offset*, NetSuite con el `Adjustment Account`,
Zoho como campo obligatorio—, y que en todos está **condicionado a llevar inventario perpetuo**. Es
decir: no es un campo del ajuste, es la consecuencia de tener un libro mayor.

**Qué haría falta:** un módulo contable con plan de cuentas y asientos, y una configuración de
contrapartidas por tipo de movimiento. Es un hito entero, muy por encima del alcance actual, y se
anota aquí para que conste que la ausencia es de alcance y no un descuido.

### Aprobación de ajustes por umbral de importe

**Por qué:** un ajuste mueve existencia **sin una operación comercial detrás**, y eso lo convierte
en el hueco natural de un inventario. Hoy hay una defensa parcial: el permiso
`inventory.adjustments.confirm` es independiente de `.create`, así que un rol puede registrar sin
poder confirmar. Lo que falta es que, **por encima de un importe**, lo firme alguien distinto de
quien lo registró. El sistema de referencia lo tiene, con el umbral configurable por empresa y
comparado contra el **valor absoluto** del impacto: un faltante grande merece la segunda firma igual
que un sobrante.

**Qué haría falta:** un estado nuevo «esperando aprobación» con sus transiciones, un parámetro de
empresa con el umbral, el rastro de quién confirma —que el ajuste ya guarda— y su pantalla. Es un
hito de control interno completo, no un campo.

### Conteo físico como documento propio

**Por qué:** hoy el ajuste captura un **delta** («salen 5 rotas»), que es lo que hace falta para
merma, daño, robo y hallazgo. Un conteo de verdad se captura al revés: se escribe **la cantidad
contada** y el sistema calcula la diferencia. El sistema de referencia, Odoo y ERPNext capturan así.

**Qué haría falta:** un documento propio que congele el saldo del sistema al abrir el conteo, deje
escribir lo contado línea por línea y, al cerrarlo, **vuelva a comprobar que la existencia no se
movió entretanto** —si se movió, la diferencia ya no es la que hay y toca recontar—. Se descartó
cambiar el ajuste a cantidad contada porque rompería el caso frecuente sin resolver ese problema.

### Rastro de autor en el resto de los documentos

**Por qué:** desde la revisión de Ajustes, el ajuste guarda **quién lo registró y quién lo confirmó
o anuló**. Ningún otro documento lo hace: ni órdenes, ni entradas, ni pedidos, ni despachos, ni
facturas, ni cobros.

**Qué haría falta:** decidir primero **quién le pasa el usuario al dominio** —el caso de uso, como
en el ajuste— y repetirlo en los seis contextos, con su migración y su columna nulable para lo ya
escrito. Se hace cuando se revise cada módulo, o de golpe al revisar Acceso.

### Ventas: lo que quedó fuera del H5

**Por qué:** el H5 cierra vender → despachar → facturar. Lo demás cabe sobre lo construido.

**Qué habría que hacer:**
- **Avisar cuando un ajuste de salida deja pedidos sin existencia**: hoy el ajuste se aplica sin mirar
  las reservas (a propósito: registra algo que ya pasó) y el despacho falla después con un mensaje
  claro. La mejora es avisar al confirmar el ajuste qué pedidos quedan afectados, sin bloquearlo.
  Explicado en `modulos/inventario.md` §1.0.1
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

- **Tipo «no inventariado»**, además de servicio. El sistema de referencia tiene cuatro tipos (`inventoried`,
  `non_inventoried`, `service`, `serialized`) y agrupa los dos que no llevan existencia
  (`NON_STOCKED_TYPES`). **Qué haría falta:** un valor más en el tipo del artículo; la regla de `moves_stock` ya
  cubriría el resto.
  **Decidido en la revisión de Existencias (19-sep-2026): no se agrega todavía.** El comportamiento ya está
  disponible —un servicio tampoco mueve existencia—, así que lo único que aportaría es una etiqueta más honesta
  para un bien físico que no se controla (empaques, papelería). Se comprobó que **ninguna regla del sistema
  distingue hoy un bien de un servicio**, ni siquiera las fiscales. Mismo criterio que con los campos de la bodega
  en el Catálogo: un campo se añade cuando existe el flujo que lo consume. Se construye el día que una regla —una
  declaración de IVA que separe bienes de servicios— necesite distinguirlos.
- **Facturar el pedido por partes sin despacho.** Hoy un pedido de solo servicios se factura entero de una vez. **Qué
  haría falta:** elegir qué líneas y cuánto de cada una entra en la factura, como el `invoiceable-lines` del compañero.
- **Cerrar el pedido cuando todo está despachado *y* facturado.** El compañero tiene un estado `completed` que exige
  las dos cuentas al 100 %; aquí el pedido queda en «despachado» aunque falte facturar. **Qué haría falta:** un estado
  más y recalcularlo también al emitir y al anular una factura.

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

### Artículos: lo que dejó abierto la revisión de la fase 4

**Por qué:** son detalles que no producen un dato falso hoy, y arreglarlos ahora costaría más de lo
que evita. Se anotan para no redescubrirlos.

**El buscador no trata el texto como literal.** `q` va a un `contains` de Prisma, así que **no hay
inyección** —la consulta va parametrizada—, pero `%` y `_` llegan como comodines de `LIKE`: buscar
`%` devuelve casi todo. Haría falta escapar esos dos caracteres antes de pasarlos, y decidir si `*`
debería funcionar como comodín explícito.

**El total del listado se cuenta aparte.** `findMany` y `count` corren en paralelo sobre la misma
condición pero sin transacción: si alguien crea un artículo justo entre las dos, el `total` no
cuadra con la página. Es cosmético. Haría falta envolver ambas en una transacción de solo lectura, o
asumirlo y documentarlo en la API.

**La cantidad a pedir no tiene techo.** `reorder_quantity` solo exige ser cero o más: puede ser
mayor que el máximo de la regla, y entonces el aviso sugiere pedir más de lo que cabe. Ni el `CHECK`
de la tabla ni la entidad lo relacionan con el mínimo y el máximo. Habría que decidir si es un error
o una libertad legítima —hay negocios que compran por lotes cerrados— antes de cerrarlo.

**La paginación va por desplazamiento.** Con el desempate por identificador ya no pierde artículos,
pero pedir la página mil sigue obligando a la base a contar las anteriores. Con un maestro grande
haría falta paginar por cursor, y selectores que busquen contra el servidor en vez de recorrer
páginas.

### Retención de impuestos: un hito propio, no un campo

**Decidido el 18-sep-2026.** Se construye, pero **completo y como hito aparte**, no como un campo
suelto dentro del catálogo.

**Por qué no basta con el campo.** El ERP de referencia guarda `has_withholding` y
`withholding_percentage` en el impuesto, los copia a la línea y los suma en la cabecera. Leyendo su
código, ahí se detiene: **no descuenta del total, no descuenta del saldo por cobrar y no emite
comprobante** —en compras, además, un comentario promete que la retención baja lo pagadero y el
código nunca hace esa resta—. Un contribuyente especial que use eso no puede justificar nada ante el
fisco, y su cuenta por cobrar queda mal, porque el cliente paga menos de lo que la factura dice.

**Dónde vive de verdad la retención.** No en el impuesto: el IVA es el mismo para todos. Depende de
**quién compra** —si es agente de retención y con qué porcentaje—, así que es una propiedad del
cliente y del proveedor. Modelarla en el impuesto es ponerla en el sitio equivocado.

**Qué haría falta, en orden:**

1. **El cliente y el proveedor** dicen si son agentes de retención y con qué porcentaje (75 % o
   100 % del impuesto, que es lo que fija la providencia vigente).
2. **El cálculo** al emitir la factura: la retención se practica **sobre el impuesto**, no sobre la
   base imponible, y se congela en el documento como todo lo demás.
3. **El comprobante de retención** como documento propio, con su correlativo y su fecha. Es lo que
   permite al proveedor justificar que ese impuesto ya se enteró; sin él, la retención no sirve.
4. **El efecto en la cobranza**: el saldo de la factura baja con el comprobante, no con un cobro.
   Eso toca cuentas por cobrar y el estado de cuenta.
5. **Distinguir el tipo** (IVA e ISLR tienen bases y porcentajes distintos).

Mientras no exista, el sistema no contempla retenciones y los documentos cobran el impuesto
completo, que es coherente para una empresa que no es agente de retención ni le retienen.

## Pedir un documento de Compras por su identificador

**Qué es.** `GET /purchasing/{suppliers,orders,receipts}/:id`. Hoy sólo existen los listados: un
documento se encuentra buscándolo por su código, no pidiéndolo.

**Por qué no se hizo** (revisión de Compras, 19-sep-2026, H3). No es un defecto sino una carencia:
nada deja de funcionar sin ello, y la búsqueda por texto que la misma revisión añadió permite
llegar a un documento concreto. Lo que no se puede hoy es **enlazar**: el kardex muestra `ENT000001`
y no puede llevar a esa entrada; «En camino» nombra `OC000001` y no puede llevar a esa orden.

**Qué haría falta.** Tres rutas con su permiso, tres casos de uso que reutilicen la resolución de
nombres de los buscadores —proveedor, bodega, artículos—, sus pruebas, y una fila por ruta en la
matriz de aislamiento, porque son rutas que aceptan un identificador.

## Unificar los tramos de antigüedad de saldos

**Qué es.** Los cinco tramos —`current`, `days1To30`, `days31To60`, `days61To90`, `over90`— y la
regla que decide en cuál cae cada factura están escritos **dos veces**:
`receivables/domain/aging/aging.ts` y `reporting/domain/aging/aging.ts`.

**Por qué no se hizo** (revisión de Cuentas por cobrar, 19-sep-2026). Hoy las dos coinciden, y se
comprobó con el caso que las habría separado: una factura con 126 días de mora cae en `over90` en
los tres sitios que la muestran. Unificarlas ahora cruzaría dos contextos que a propósito no se
importan entre sí.

**Qué haría falta.** Un contrato publicado entre `reporting` y `receivables`, como el que compras y
el inventario ya usan para escribir el kardex: la regla vive en un sitio, el otro la consume por un
puerto, y el contrato de puerto comprueba que los dos dicen lo mismo.

**Por qué importa.** Son dos escrituras de la misma regla, y sólo una se actualiza cuando la regla
cambia. Es exactamente la forma del defecto que la revisión de Ventas encontró en el reservado:
tres cálculos que coincidían en todo menos en una palabra.

## El bloqueo por intentos, fuera de la memoria del proceso

**Qué es.** El contador de intentos fallidos vive en dos `Map` dentro del proceso de la API
(`in-memory-login-attempts.ts`). Con una sola instancia funciona; con varias, cada una cuenta por su
lado y el límite se multiplica por el número de instancias. Y un despliegue borra los bloqueos: se
comprobó con `docker compose restart api`, y la cuenta bloqueada entró de inmediato.

**Por qué no se hizo** (revisión de Acceso, 19-sep-2026). El sistema corre en una sola instancia, y
lo que hacía daño de verdad —que bastaran cinco intentos ajenos para dejar fuera a un compañero, y
que el mapa creciera sin límite con correos inventados— sí se arregló: ahora se cuenta también por
dirección de red y las entradas caducadas se barren.

**Qué haría falta.** Otra implementación del mismo puerto `LoginAttempts` contra Redis o contra una
tabla, y su prueba de contrato corriendo contra las dos, como el resto de puertos del proyecto. No
hay que tocar ni el dominio ni el caso de uso: el puerto ya existe y no sabe dónde se guarda.

## Revocar una sesión concreta, no todas

**Qué es.** Hoy la revocación es una fecha de corte por persona (`users.sessions_valid_from`): al
cambiar la contraseña caen **todas** las sesiones anteriores. No se puede ver qué sesiones hay
abiertas ni cerrar una sola, «este portátil sí, el teléfono no».

**Por qué no se hizo** (revisión de Acceso, 19-sep-2026). Rafael eligió la fecha de corte frente a
una tabla de sesiones: resuelve lo que hacía daño —que quien se llevara una sesión siguiera dentro
tras cambiar la contraseña— con una columna y una comprobación, y regala «cerrar en todos los
dispositivos». Una tabla de sesiones añade una consulta a cada petición y una limpieza periódica.

**Qué haría falta.** Una tabla `sessions` con su identificador dentro del token, su fecha de
revocación, el agente y la última actividad; una pantalla que las liste; y decidir qué hacer con las
filas viejas. La fecha de corte actual seguiría valiendo para «cerrarlas todas».

## Que nadie pueda dejar fuera a otro a propósito

**Qué es.** Cinco intentos fallidos contra un correo real lo bloquean quince minutos. Quien conozca
el correo de un compañero puede dejarlo fuera a voluntad, repitiéndolo cada quince minutos.
Comprobado contra la API: cinco intentos ajenos, y después la contraseña **correcta** responde
`429`.

**Por qué no se hizo** (revisión de Acceso, 19-sep-2026). El intento de cerrarlo contando también
por dirección tumbó la suite dos veces, porque una suite de pruebas **es** un barrido de cuentas
desde una sola dirección. La regla que quedó —contar sólo los correos **inexistentes** que se
prueban desde una dirección— frena la enumeración, que es el ataque real, pero deja este caso
abierto a propósito: contar los fallos sobre cuentas reales dejaría fuera a una oficina entera
detrás de una misma salida a internet, que es un daño mayor y más probable.

**Qué haría falta.** Lo que hacen los productos maduros: no bloquear la cuenta, sino **encarecer el
intento** —un retardo creciente por cuenta, o un desafío tras varios fallos— de modo que el dueño
legítimo siempre pueda entrar aunque otro esté probando. Un desafío trae dependencia externa y hay
que decidir cuál; el retardo creciente no, y es el primer paso natural.
