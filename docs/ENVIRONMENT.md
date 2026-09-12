# Variables de entorno

Toda la configuración que cambia entre entornos vive aquí. **Desplegar no requiere
tocar el `Dockerfile`, el `docker-compose.yml` ni el `Makefile`**: solo definir estas
variables en la plataforma correspondiente.

## Principio

Un error de configuración debe **romper el arranque**, no degradar la aplicación en
silencio. Ambas aplicaciones validan su entorno al iniciar contra un esquema, y si
algo falta o tiene forma incorrecta, el proceso no levanta y dice exactamente qué
está mal.

Los valores por defecto existen **solo fuera de producción**. En producción, una
variable ausente es un fallo, no una invitación a improvisar.

## API (`apps/api`)

Validadas en `src/shared/config/env.schema.ts`.

| Variable | Requerida | Por defecto | Descripción |
|---|---|---|---|
| `DATABASE_URL` | **Sí** | — | Cadena de conexión de PostgreSQL. Debe empezar por `postgres://` o `postgresql://` |
| `PORT` | No | `3001` | Puerto de escucha. Las plataformas suelen asignarlo ellas |
| `NODE_ENV` | No | `development` | `development`, `test` o `production` |
| `JWT_SECRET` | **En producción** | Uno de desarrollo | Firma los tokens de sesión |
| `JWT_TTL_SECONDS` | No | `3600` | Cuánto dura una sesión |
| `LOGIN_MAX_FAILED_ATTEMPTS` | No | `5` | Intentos fallidos por correo antes de bloquear |
| `LOGIN_LOCKOUT_SECONDS` | No | `900` | Cuánto dura el bloqueo, y la ventana en que se cuentan los fallos |

**Guardas adicionales** cuando `NODE_ENV=production`, todas verifican al arrancar:

- `DATABASE_URL` no puede apuntar a `localhost` — evita el accidente de desplegar
  contra la base local
- `JWT_SECRET` no puede ser el valor de desarrollo, y debe medir **32 caracteres o
  más**. Un secreto publicado en el repositorio deja de ser un secreto: cualquiera que
  lo lea podría firmar un token válido y entrar como quien quisiera

El `.env` local **no trae ningún secreto escrito**. `make env` genera un `JWT_SECRET`
aleatorio la primera vez, y `make up` lo llama solo. Por eso `.env.example` deja esa
variable vacía en vez de proponer un valor.

## Frontend (`apps/web`)

Validadas en `src/env.ts`.

| Variable | Requerida | Por defecto | Descripción |
|---|---|---|---|
| `API_URL` | **En producción sí** | `http://localhost:3001` (solo fuera de producción) | Dirección de la API. La lee **el servidor de Next**, nunca el navegador |
| `NODE_ENV` | No | `development` | Lo define la plataforma |

**Sin prefijo `NEXT_PUBLIC_` a propósito.** Ese prefijo incrusta el valor en el
JavaScript que se envía al navegador, es decir, lo publica. Aquí la petición sale
del servidor de Next, así que el navegador nunca conoce la dirección de la API.

**Guarda adicional:** si `NODE_ENV=production` y falta `API_URL`, o apunta a
`localhost`, el arranque falla.

## Docker Compose (raíz)

Plantilla en `.env.example`. Todas tienen valor por defecto: sin `.env`, el sistema
levanta igual.

| Variable | Por defecto | Descripción |
|---|---|---|
| `POSTGRES_USER` | `nexora` | Usuario de la base local |
| `POSTGRES_PASSWORD` | `nexora` | Contraseña de la base local |
| `POSTGRES_DB` | `nexora` | Nombre de la base local |
| `BIND_HOST` | `127.0.0.1` | Interfaz a la que se publican los puertos |
| `DB_PORT` | `5432` | Puerto de PostgreSQL en la máquina anfitriona |
| `API_PORT` | `3001` | Puerto de la API en la máquina anfitriona |
| `WEB_PORT` | `3000` | Puerto del frontend en la máquina anfitriona |
| `API_INTERNAL_PORT` | `3001` | Puerto de la API dentro de la red del compose |

**`BIND_HOST` es una decisión de seguridad.** Con `127.0.0.1` los servicios solo son
accesibles desde tu máquina. Ponerlo en `0.0.0.0` los expone a toda la red: correcto
en un servidor detrás de un proxy inverso, peligroso en un portátil conectado a una
red ajena.

## Pruebas end-to-end (`apps/e2e`)

| Variable | Por defecto | Descripción |
|---|---|---|
| `WEB_URL` | `http://localhost:3000` | Frontend bajo prueba |
| `API_URL` | `http://localhost:3001` | API bajo prueba |
| `CI` | — | Si está definida, activa reintentos y prohíbe `test.only` |

**Guarda de entorno:** las pruebas destructivas comprueban que `WEB_URL` y `API_URL`
apuntan a un entorno desechable (`localhost`, `127.0.0.1`, o los servicios del
compose) y **abortan** en caso contrario. Ver `support/infrastructure.ts`.

## Despliegue en un servidor propio

El `.env` de producción **se crea en el servidor y nunca viaja en git**. No es
código: es infraestructura. Pertenece a la máquina, no al repositorio, y por eso su
ciclo de vida es el del servidor.

```bash
# La primera vez, en el servidor:
git clone https://github.com/Rafarars/nexora-erp.git
cd nexora-erp
cp .env.example .env
nano .env             # credenciales reales
chmod 600 .env        # solo el dueño puede leerlo
docker compose up -d

# En cada despliegue posterior:
git pull && docker compose up -d --build
```

El `.env` se crea una vez y **sobrevive a todos los `git pull`**, precisamente porque
git no lo conoce.

### Lo que NO se debe hacer

| | Por qué no |
|---|---|
| Escribir los valores de producción en `docker-compose.yml` | Ese archivo **sí se versiona**: estarías publicando las credenciales en GitHub |
| Commitear el `.env` | Un secreto que entra al historial queda comprometido para siempre. Rotar la credencial es la única solución real; borrar el commit no basta |

### Valores obligatorios en producción

Los valores por defecto del `docker-compose.yml` son **una red para desarrollo, no un
plan de producción**. En un servidor real hay que definir como mínimo:

```bash
POSTGRES_PASSWORD=   # larga y aleatoria: la de por defecto esta publicada en GitHub
JWT_SECRET=          # 32+ caracteres: openssl rand -hex 32
BIND_HOST=0.0.0.0    # solo si hay un proxy inverso delante; si no, dejar 127.0.0.1
```

Y en la API, `NODE_ENV=production`, que activa las guardas de configuración: la
aplicación se niega a arrancar si `DATABASE_URL` apunta a `localhost` o si el
`JWT_SECRET` es el de desarrollo.

**Rotar el `JWT_SECRET` cierra todas las sesiones abiertas**, porque los tokens ya
emitidos dejan de verificar. Es el efecto deseado si se sospecha de una filtración.

**El seed de demostración nunca debe correr en producción**: sus contraseñas están en
el repositorio. `make seed` se niega a ejecutarse con `NODE_ENV=production`.

### Otras formas de llevar los secretos al servidor

| Método | Cuándo |
|---|---|
| **Manual** — crear el `.env` por SSH la primera vez | Un servidor, un proyecto. Simple y suficiente |
| **Desde el CI** — el pipeline lo escribe al desplegar, leyéndolo de los secretos de GitHub | Varios servidores o despliegues frecuentes |
| **Gestor de secretos** — Vault, AWS Secrets Manager, Doppler | Equipos, auditoría, rotación de credenciales |

Las tres comparten lo mismo: **el secreto nunca pasa por el repositorio.**

## Integración continua

El pipeline **no tiene ni un secreto configurado**, y es deliberado: no pide permisos
que no usa. Funciona con los valores por defecto del `docker-compose.yml`, porque el
runner es desechable —nace y muere con la corrida— y su base de datos solo es
alcanzable desde dentro de esa misma máquina.

GitHub Actions define dos variables por su cuenta:

| Variable | Para qué |
|---|---|
| `CI` | Convención de industria. Activa los reintentos de Playwright y prohíbe un `test.only` olvidado |
| `GITHUB_TOKEN` | Se genera por corrida. Permite publicar el reporte en Pages |

Harán falta secretos cuando el pipeline **despliegue**, no solo pruebe: un token de
Vercel, un enlace de despliegue de Render o una llave SSH. Se guardan en
*Settings → Secrets and variables → Actions* y se usan como `${{ secrets.NOMBRE }}`.

## Qué configurar en cada plataforma

| Pieza | Plataforma | Variables a definir |
|---|---|---|
| Base de datos | Supabase / Neon | Ninguna: la plataforma **entrega** la cadena de conexión |
| API | Render / Koyeb | `DATABASE_URL`, `NODE_ENV=production` (`PORT` lo asigna la plataforma) |
| Frontend | Vercel | `API_URL` con la URL pública de la API |

> Los valores concretos se documentarán al realizar el despliegue. No se anticipan
> aquí para no dejar escrito algo sin verificar.
