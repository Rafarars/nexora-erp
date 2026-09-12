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

**Mensajes de error que repiten la entrada.** Algunos errores de validación incluyen el
valor recibido (`received <no-es-uuid>`). Son JSON, sin riesgo de XSS, pero no hace falta
devolverle a nadie lo que mandó.
