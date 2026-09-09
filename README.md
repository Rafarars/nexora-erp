# Nexora ERP

[![CI](https://github.com/Rafarars/nexora-erp/actions/workflows/ci.yml/badge.svg)](https://github.com/Rafarars/nexora-erp/actions/workflows/ci.yml)

Sistema ERP multiempresa con arquitectura hexagonal y suite de automatización de pruebas.

**[Ver el último reporte de pruebas](https://rafarars.github.io/nexora-erp/)**

## Levantar el sistema

```bash
docker compose up -d --build
```

| Servicio | Dirección |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Estado del sistema | http://localhost:3001/health |

## Pruebas

```bash
pnpm test:unit   # dominio, sin base de datos
pnpm test:e2e    # Playwright: API, interfaz y resiliencia
```

> Documentación completa en construcción. Plan del proyecto en [`docs/PLAN.md`](docs/PLAN.md).
