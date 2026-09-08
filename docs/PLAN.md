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

### H1 — Acceso
Usuarios, roles y permisos. Autenticación con token.
*Pruebas:* guardas de permisos por endpoint, sesión en E2E, POM de login reutilizable por toda la suite.

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

## 9. Riesgos asumidos

| Riesgo | Mitigación |
|---|---|
| El alcance crece y el proyecto no se termina | Hitos cerrados; ninguno se abre sin cerrar el anterior en verde |
| Las 7 postulaciones se quedan esperando | Enlace presentable a partir de H3 |
| El despliegue gratuito duerme y el reclutador ve pantalla blanca | El entregable principal es el reporte en GitHub Pages, siempre vivo |
| Percepción de copia del sistema del cliente | Código, pantallas, modelo y nombre propios; vocabulario estándar de industria |
| Módulos avanzando más rápido que las pruebas | Regla dura: ningún hito se cierra con la suite incompleta |

---

## 10. Decisiones pendientes

- Nombre del repositorio y del ERP
- Si se envían las 7 postulaciones de QA al cerrar H3 o al terminar todos los hitos
- Servicio final para la API (Render vs Koyeb) y para la base de datos (Supabase vs Neon),
  verificando condiciones vigentes al momento del despliegue
