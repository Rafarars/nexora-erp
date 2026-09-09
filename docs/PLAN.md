# Plan — Portafolio público de automatización de pruebas sobre un ERP propio

**Autor:** Rafael Rodríguez Sosa (github.com/Rafarars)
**Definido:** 08-sep-2026
**Estado:** plan aprobado en discusión, pendiente de ejecución

---

## 1. Por qué existe este proyecto

En el CV y en las postulaciones de QA se afirma experiencia en automatización con Playwright
(14 suites, 222 archivos de test, 34 Object Mothers, 65 escenarios Gherkin). Todo eso es real,
pero vive en el repositorio de un cliente y **no se puede exponer**. En github.com/Rafarars no
hay hoy ni un repositorio de pruebas automatizadas.

Quedan 7 postulaciones de QA por enviar. Con cientos de candidatos por vacante, "tengo experiencia
en automatización" sin nada que mirar se resuelve pasando al siguiente currículum.

**Objetivo:** que en el CV y en cada postulación haya un ENLACE en vez de una afirmación.

**Criterio de éxito:** un reclutador entra al repositorio, ve la insignia de CI en verde, hace clic
y llega al reporte de Playwright con escenarios, trazas y capturas. En menos de 30 segundos tiene
la prueba de que el candidato sabe automatizar.

**Lo que NO es:** no es copiar el sistema del cliente. El código, las pantallas, el modelo de datos
y el nombre son propios. Los conceptos (stock, factura, cuentas por cobrar) son vocabulario estándar
de la industria, presentes en SAP, Odoo y cualquier ERP.

---

## 2. Qué se construye

Un **ERP genérico** propio, completo y funcional, y sobre él la suite de automatización.

Punto clave de encuadre: **el producto del portafolio es la suite de pruebas.** El ERP es el sistema
bajo prueba. Se construye bien —hexagonal, SOLID, ATDD, dockerizado, desplegado— porque un sistema
serio permite pruebas serias, y porque saber construir refuerza el perfil de SDET. Pero ningún
módulo se considera terminado hasta que su suite está en verde.

**Regla de alcance (definida el 09-sep-2026): profundidad máxima en los cimientos, módulos los que
dé el tiempo.** El valor del portafolio no está en cuántos módulos tenga el ERP, sino en la base:
multitenencia, permisos, hexagonal bien hecha, la pirámide de pruebas completa, el CI y el
despliegue. Eso es lo que no se improvisa y lo que un revisor técnico reconoce. Los módulos son
carpintería repetida: una vez que inventario está hecho con dominio, puertos, adaptadores, pruebas
en cinco niveles y su E2E, ventas es el mismo trabajo otra vez. Tres módulos impecables valen más
que siete a medio probar. Como cada hito cierra en verde, se puede parar en cualquier punto sin
quedar a medias.

---

## 3. Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Backend | **NestJS + TypeScript** | Inyección de dependencias nativa: puertos y adaptadores salen naturales. Es el equivalente Node de Symfony/Laravel |
| Frontend | **Next.js + React** | Consume la API. Despliegue directo en Vercel |
| Base de datos | **PostgreSQL** | Mismo motor en local, CI y producción |
| ORM | **Prisma** | El esquema vive aparte y el cliente generado se usa SOLO en adaptadores de infraestructura. TypeORM tienta a meter decoradores en las entidades del dominio, lo que rompería la hexagonal |
| Pruebas backend | **Jest** | Viene configurado de fábrica en NestJS. Es el PHPUnit del mundo JS |
| Pruebas E2E y API | **Playwright + TypeScript** | La herramienta que se quiere demostrar |
| ATDD | **Gherkin (@cucumber/cucumber)** | Espejo de los 65 escenarios Behat del trabajo real |
| Pruebas de componentes | **Vitest + Testing Library** | Ya usado en los 13 tests de Vue del trabajo real |
| Entorno | **Docker Compose** | Postgres + API + web con un comando |
| CI/CD | **GitHub Actions** | Gratis e ilimitado en repositorios públicos |
| Reporte | **GitHub Pages** | Gratis en repositorios públicos. Siempre vivo |

### Despliegue

| Pieza | Servicio | Nota |
|---|---|---|
| Frontend Next.js | Vercel | Su caso de uso exacto, cero fricción |
| API NestJS (Docker) | Render o Koyeb | Plan gratuito, corre el contenedor |
| PostgreSQL | Supabase o Neon | Postgres gestionado gratis |

**Advertencia asumida:** los planes gratuitos duermen o pausan por inactividad (Render tarda cerca
de un minuto en despertar; Supabase pausa proyectos inactivos). Verificar condiciones vigentes al
llegar al despliegue, porque cambian seguido.

Mitigaciones:
1. Job programado que hace ping periódico a la API.
2. **La importante:** el entregable principal es el reporte de CI en GitHub Pages, que es estático
   y está siempre disponible. La app desplegada es el bonus, con aviso en el README.

---

## 4. Estructura del repositorio

```
<nombre-erp>/
├── apps/
│   ├── api/                    # NestJS — backend hexagonal
│   ├── web/                    # Next.js — frontend
│   └── e2e/                    # Playwright: UI + API + Gherkin
├── packages/
│   └── contracts/              # tipos compartidos entre api y web
├── docker-compose.yml
├── .github/workflows/
│   ├── ci.yml                  # lint, tipos, unit, integración, e2e, reporte
│   └── deploy.yml              # despliegue tras CI en verde
└── README.md
```

### Backend por contextos delimitados

```
apps/api/src/
├── contexts/
│   ├── access/                 # usuarios, roles, permisos
│   ├── catalog/                # productos, categorías, almacenes
│   ├── inventory/              # entradas, salidas, ajustes, movimientos
│   ├── sales/                  # clientes, órdenes, facturas
│   └── receivables/            # pagos, saldos, vencidas, límite de crédito
└── shared/
```

Cada contexto con las tres capas:

```
inventory/
├── domain/           # entidades, value objects, PUERTOS (interfaces), excepciones
├── application/      # casos de uso, DTOs
└── infrastructure/   # controladores HTTP, ADAPTADORES Prisma, módulo Nest
```

Es la misma organización de `src/Flexio/` que ya se maneja a diario, traducida a TypeScript.

### Puertos y adaptadores — el mecanismo

```ts
// domain/ports/product.repository.ts — el PUERTO. Dice QUÉ se necesita.
export interface ProductRepository {
  findById(id: ProductId): Promise<Product | null>;
  save(product: Product): Promise<void>;
}
```
```ts
// infrastructure/persistence/prisma-product.repository.ts — el ADAPTADOR.
@Injectable()
export class PrismaProductRepository implements ProductRepository { /* ... */ }
```
```ts
// infrastructure/inventory.module.ts — el cableado. Equivale a services.yaml de Symfony.
providers: [{ provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository }]
```

**Regla dura:** la carpeta `domain/` no importa nada de NestJS, ni de Prisma, ni de HTTP.
Si lo hace, la hexagonal es de mentira.

### Multitenencia (decidida el 09-sep-2026)

El sistema es **multiempresa desde el H1**, con **multitenencia por fila**: una columna `tenantId`
en cada tabla del negocio, más un guardián que la aplica en toda consulta.

Por qué por fila y no un esquema de base de datos por empresa: la segunda opción se ve mejor en un
diagrama y es un dolor en migraciones, siembra de datos, pruebas y despliegue. La primera es la que
usan los SaaS reales.

Por qué desde el H1 y no después: añadirla al principio cuesta una columna y un guardián; añadirla
después obliga a tocar cada tabla, cada consulta, cada endpoint y cada prueba del sistema. Es la
decisión que no se puede posponer.

Por qué importa para el portafolio: la prueba que demuestra que **la empresa A no puede ver, editar
ni borrar los datos de la empresa B** es el tipo de prueba que separa a un tester de formularios de
alguien que entiende autorización y límites de seguridad. Vale más que veinte pruebas de CRUD.

Son dos guardianes distintos y cada uno con sus propias pruebas: **inquilino** (a qué empresa
perteneces) y **permiso** (qué puedes hacer dentro de ella).

---

## 5. Estrategia de pruebas

Este es el corazón del portafolio. Cada nivel demuestra algo distinto.

| Nivel | Herramienta | Qué prueba | Necesita BD |
|---|---|---|---|
| **Dominio** | Jest | Invariantes y reglas de negocio sobre clases puras | No |
| **Aplicación** | Jest | Casos de uso completos con repositorios en memoria | No |
| **Contrato de puerto** | Jest | La MISMA suite corre contra el doble en memoria y contra el adaptador Prisma | Sí |
| **API** | Playwright request | Endpoints REST: contratos, códigos de estado, autorización | Sí |
| **E2E UI** | Playwright + POM | Flujos de usuario en el navegador | Sí |
| **ATDD** | Gherkin sobre Playwright | Flujos de negocio en lenguaje de negocio | Sí |
| **Componentes** | Vitest + Testing Library | Componentes React aislados | No |
| **Rendimiento** | Playwright con umbral | Guardas de tiempo de respuesta | Sí |

### Piezas destacadas (los argumentos de entrevista)

1. **Las pruebas de dominio corren sin base de datos, sin Docker y sin framework, en milisegundos.**
   Eso ES la demostración de que la arquitectura está bien hecha. Si necesitaran infraestructura,
   la hexagonal sería decorativa.
2. **Pruebas de contrato de puerto:** una sola suite que se ejecuta dos veces, contra el repositorio
   en memoria y contra el de Prisma. Prueba que el doble usado en las pruebas rápidas se comporta
   igual que el real. Poca gente hace esto y se nota.
3. **Object Mothers y fixtures propios**, igual que en el trabajo real.
4. **Al menos una guarda de rendimiento** con umbral que rompe el CI si se degrada.
5. **Un test de regresión que documenta un bug real** encontrado y corregido durante el desarrollo,
   con el enlace al commit del fix en el propio test.
6. **Page Object Model** en todos los E2E de interfaz.

---

## 6. Hitos

Cada hito termina con: código, pruebas de todos los niveles que apliquen, CI en verde y despliegue
actualizado. Ningún hito se cierra con la suite en rojo.

### H0 — Fundación técnica
Monorepo, NestJS vacío, Next.js vacío, Postgres en Docker Compose, Prisma conectado, y **el CI
completo funcionando desde el día uno** con una prueba de humo de punta a punta.
*Salida:* pipeline verde con una prueba trivial. La infraestructura de pruebas existe antes que las
funcionalidades.

### H1 — Multiempresa y acceso

**Modelo de acceso (decidido el 09-sep-2026)**

- El `tenantId` viaja **dentro del token**, nunca en una cabecera ni en la ruta. Cambiar
  de empresa es un endpoint que verifica pertenencia y **reemite el token**
- `User` **no** lleva `tenantId`: una persona es una cuenta con correo único global. Lo
  que la ata a una empresa es una **membresía**, y los roles se asignan a la membresía
- **Permisos**: catálogo global, identificados por su **código** (`sales.invoices.create`).
  El código es su identidad natural: único, estable y legible. Un identificador
  artificial obligaría a buscarlo en la base cada vez que se declara uno
- **Roles**: por empresa. Cada una agrupa permisos como quiera
- **Rol de administrador con `grantsAll`**, en vez de listar sus permisos: así los
  permisos que se creen en el futuro quedan cubiertos sin actualizar nada
- **Superusuario sin atajos**: membresía en todas las empresas con rol de administrador.
  Ningún `if` que salte el guardián. `grantsAll` concede todos los permisos **dentro de
  su empresa**; no cruza el aislamiento
- **Guardián declarativo que deniega por defecto**: cada endpoint declara su permiso con
  un decorador; **un endpoint sin permiso declarado se deniega**. Olvidarlo cierra el
  sistema, nunca lo abre

**Fases**

- [x] **0. Convención** — `docs/ARCHITECTURE.md` y primitivas de `shared/domain`
- [x] **1. Modelo y migración** — `Tenant`, `User`, `Membership`, `Role`, `Permission`
- [ ] **2. Dominio** — entidades, value objects y puertos. Pruebas sin base de datos
- [ ] **3. Aplicación** — casos de uso con repositorios en memoria. Pruebas sin base de datos
- [ ] **4. Infraestructura** — repositorios Prisma y **pruebas de contrato de puerto**
- [ ] **5. Autenticación** — Argon2, emisión de token, `/auth/login` y `/auth/switch-tenant`
- [ ] **6. Guardianes** — inquilino y permisos, más la **prueba que recorre todas las rutas**
      y verifica que cada una declara un permiso o es explícitamente pública
- [ ] **7. Frontend** — login, cookie `httpOnly`, ruta protegida
- [ ] **8. E2E** — POM de login y **aislamiento entre empresas** (404, no 403)
- [ ] **9. Semillas** — dos empresas y el superusuario
- [ ] **10. Cierre** — ajustar la convención y extraer las skills

*Pruebas:* **aislamiento entre empresas** (la empresa A intenta leer, editar y borrar
datos de la empresa B y rebota en los tres casos), guardas de permisos por endpoint,
sesión en E2E, POM de login reutilizable por toda la suite.

### H2 — Catálogo
Productos, categorías, unidades de medida, almacenes.
*Pruebas:* CRUD por API, validaciones de dominio, componentes de formulario, primer flujo E2E completo.

### H3 — Inventario
Entradas, salidas, ajustes, historial de movimientos, stock por almacén.
*Pruebas:* **guarda de inventario en cero** (no se puede sacar más de lo que hay), integridad del
historial de movimientos, consistencia entre movimientos y saldo de stock.
*→ A partir de aquí el enlace ya es presentable en postulaciones.*

### H4 — Ventas
Clientes, cotización, orden de venta, factura. Descuento de stock al facturar.
*Pruebas:* el flujo cruzado completo en Gherkin, stock comprometido, ATDD del ciclo de venta.

### H5 — Cuentas por cobrar
Pagos, saldos, cuentas vencidas, límite de crédito del cliente.
*Pruebas:* **anular un pago revierte el saldo**, cliente con vencidas no puede facturar a crédito,
consistencia entre pagos y saldo.

### H6 — Reportes y tablero
Exportación a PDF y Excel, tablero con indicadores.
*Pruebas:* verificación del contenido de los documentos generados, **guarda de rendimiento** sobre
un listado con volumen sembrado.

---

## 7. El pipeline de CI

Archivo `.github/workflows/ci.yml`, disparado en cada push y pull request:

1. Lint y verificación de tipos
2. Pruebas de dominio y aplicación (rápidas, sin infraestructura)
3. Pruebas de integración y de contrato (con servicio Postgres)
4. Levantar la app con Docker Compose
5. Playwright: API + UI + Gherkin (repartido en varios shards)
6. Publicar el reporte HTML en GitHub Pages
7. Insignia de estado en el README

Si algo falla: check rojo, no se fusiona.

**Costo: cero.** GitHub Actions es gratuito e ilimitado en repositorios públicos con runners
estándar; GitHub Pages también. La cuota de minutos aplica solo a repositorios privados.

*Detalle a recordar:* en repos públicos, los workflows programados (`schedule`) se desactivan solos
tras unos dos meses sin actividad en el repositorio.

---

## 8. El README, que es la portada

No es un instructivo de instalación. Es el argumento. Debe contener:

- Insignia de CI y enlace directo al último reporte de Playwright
- Qué se demuestra y por qué se tomó cada decisión de arquitectura
- Diagrama de la hexagonal y del flujo de una petición
- La pirámide de pruebas con conteos reales por nivel
- Sección de decisiones y sus alternativas descartadas (por qué Prisma y no TypeORM, por qué
  NestJS y no Express, por qué contract tests)
- Cómo levantarlo: un comando

---

## 9. Skills del proyecto (decidido el 09-sep-2026)

Se escriben **al cerrar el H1**, no antes. Una skill se **extrae, no se inventa**: escrita antes,
codifica suposiciones; escrita después del primer contexto completo (dominio, puertos, adaptadores,
controlador, migración y sus pruebas), codifica lo que realmente funcionó, con los tropiezos ya
resueltos. Es como nacieron las skills de Flexio.

**No se adaptan las skills de Flexio.** Se toma su estructura como referencia porque está bien
armada, pero el contenido se escribe de cero: aquellas codifican Symfony, Eloquent, Phinx y Behat;
aquí es NestJS, Prisma y Vitest. Adaptarlas sería más lento y arrastraría modismos de PHP.

| Skill | Alcance | Por qué así |
|---|---|---|
| `nest-hexagonal` | Dominio, aplicación, infraestructura **y controladores** | El controlador NO va en skill aparte: en hexagonal es solo un adaptador de entrada. Separarlo duplicaría contexto y sugeriría que es una capa propia, que es el error conceptual a evitar |
| `frontend-hexagonal` | Organización por módulos en React/Next | Skill aparte. El frontend tiene reglas propias; mezclarlo daría una skill enorme que se carga entera para cualquier tarea |
| `nexora-testing` | La pirámide completa: dominio, aplicación, contrato de puerto, API, E2E y Gherkin | Una sola: los niveles se eligen juntos, no por separado |
| Migraciones | **Ninguna nueva** | Ya está instalada `prisma-cli` (global, en Claude y agy). Como mucho, un apartado con convenciones propias dentro de `nest-hexagonal` |

**Separación en dos capas, pensando en reutilizar esto para otro ERP (p. ej. Laravel + Vue):** una
skill de **método** (cómo se piensa la hexagonal y la pirámide de pruebas — independiente del
lenguaje) y skills **finas por stack** que solo aporten sintaxis. Así, al cambiar de stack se
reescribe lo delgado y se conserva lo valioso.

---

## 10. Riesgos asumidos

| Riesgo | Mitigación |
|---|---|
| El alcance crece y el proyecto no se termina | Hitos cerrados; ninguno se abre sin cerrar el anterior en verde |
| Las 7 postulaciones se quedan esperando | Enlace presentable a partir de H3 |
| El despliegue gratuito duerme y el reclutador ve pantalla blanca | El entregable principal es el reporte en GitHub Pages, siempre vivo |
| Percepción de copia del sistema del cliente | Código, pantallas, modelo y nombre propios; vocabulario estándar de industria |
| Módulos avanzando más rápido que las pruebas | Regla dura: ningún hito se cierra con la suite incompleta |

---

## 11. Decisiones pendientes

- Si se envían las 7 postulaciones de QA al cerrar H3 o al terminar todos los hitos
- Servicio final para la API (Render vs Koyeb) y para la base de datos (Supabase vs Neon),
  verificando condiciones vigentes al momento del despliegue
