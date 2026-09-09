# Nexora ERP — reglas del proyecto

Portafolio público de automatización de pruebas de Rafael Rodríguez Sosa. El ERP es
el sistema bajo prueba; **el producto es la suite**. Todo lo que entre al repositorio
lo va a leer un reclutador técnico.

## Idioma

| Elemento | Idioma |
|---|---|
| Identificadores, archivos, `data-testid`, títulos de prueba | **Inglés** |
| Comentarios en el código | **Español** |
| Texto visible al usuario, documentación, mensajes de commit | **Español** |

## Comentarios

**Pocos y cortos.** Un comentario explica **por qué**, nunca narra lo que el código ya
dice. Nada de bloques de ocho líneas describiendo una clase evidente. Si un comentario
necesita más de dos líneas, probablemente el código deba ser más claro.

## Commits

Los hace Claude directamente, **incluido el push**, y **siempre explica qué commiteó**:
qué archivos, qué cambió y por qué.

Mensajes en español, **claros, cortos y precisos**. Una línea describiendo el efecto
del cambio:

```
Agregar endpoint de salud que verifica la conexion a la base de datos
Dockerizar el sistema y parametrizar credenciales y puertos
Cachear los navegadores de Playwright y reintentar su instalacion
```

**Nunca firmas ni atribuciones**: ni `Co-Authored-By`, ni enlaces de sesión, ni
"Generated with". El mensaje termina en la última línea de contenido real.

## Antes de commitear

```bash
make verify         # cambios de codigo o configuracion
make verify-clean   # ademas, al tocar Dockerfiles, dependencias o compilacion
```

Solo se salta en cambios de documentación pura. **Un arreglo verificado a medias es un
arreglo no verificado**: si algo se ejecuta en varios contextos (local, Docker, CI), se
comprueba en todos.

## Arquitectura

Hexagonal por contextos delimitados en `apps/api/src/contexts/<contexto>/`, cada uno
con `domain/`, `application/` e `infrastructure/`.

- **`domain/` no importa NestJS, ni Prisma, ni HTTP.** La palabra `prisma` solo puede
  aparecer en `infrastructure/`
- **Puertos = interfaz en `domain/` + token (`Symbol`)**. Las interfaces de TypeScript
  se borran al compilar y el contenedor no puede resolverlas por tipo
- **Nada de módulos `@Global()`**. Cada módulo importa explícitamente lo que necesita
- **Multitenencia por fila**: columna `tenantId` y guardián que la aplica en toda consulta

Filosofía transversal: **explícito sobre automático.**

## Pruebas

- Las de dominio corren **sin base de datos, sin Docker y sin framework**. Si necesitan
  infraestructura, la hexagonal está mal hecha
- Los `data-testid` se siembran **al escribir el componente**, no se improvisan después
  buscando clases de CSS
- Las pruebas destructivas van en su propio proyecto de Playwright, con `dependencies`
  para que corran al final, y **restauran el entorno pase lo que pase**
- Cada ejecución **garantiza su estado inicial** en vez de confiar en cómo lo dejó la
  anterior
- Ante un fallo intermitente: buscar el recurso compartido. Reintentar solo se justifica
  cuando la causa está **fuera** del sistema (una descarga externa, por ejemplo)

## Configuración y secretos

- **Ninguna credencial en el repositorio.** El `.env` nunca se commitea; `.env.example`
  sí, como contrato de qué variables hacen falta
- **Un error de configuración rompe el arranque**, no degrada la aplicación en silencio.
  Los valores por defecto solo existen fuera de producción
- Configuración de **compilación** y de **ejecución** son distintas: validar al importar
  un módulo rompe la construcción
- Si se filtra un secreto: **se rota**, no se esconde. Reescribir el historial no lo
  arregla
- Los puertos se publican en `127.0.0.1` por defecto

## Código derivado

`src/generated/prisma`, `.next/`, `dist/` y `node_modules/` **no se versionan** y se
regeneran solos mediante enganches (`postinstall`, scripts de `typecheck`), **no** como
pasos sueltos del pipeline ni instrucciones en un README.

> El repositorio debe poder reconstruirse por completo desde lo versionado, sin pasos
> manuales.

## Documentación

| Archivo | Contenido |
|---|---|
| `docs/PLAN.md` | Objetivo, hitos, estrategia de pruebas y decisiones de fondo |
| `docs/ENVIRONMENT.md` | Cada variable de entorno, despliegue y funcionamiento del CI |
| `docs/FUTURE.md` | Mejoras diferidas, con su porqué |
| `README.md` | Portada del portafolio |

Las decisiones con su porqué se guardan además en Engram, proyecto `nexora-erp`.

**Toda idea de futuro se anota en `docs/FUTURE.md`** con qué es, por qué y qué haría
falta. Nada se construye antes de que exista la necesidad, pero nada se pierde por no
haberlo escrito.
