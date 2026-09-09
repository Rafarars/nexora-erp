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
