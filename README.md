# Nexora ERP

[![CI](https://github.com/Rafarars/nexora-erp/actions/workflows/ci.yml/badge.svg)](https://github.com/Rafarars/nexora-erp/actions/workflows/ci.yml)

Sistema ERP multiempresa con arquitectura hexagonal y suite de automatización de pruebas.

**[Ver el último reporte de pruebas](https://rafarars.github.io/nexora-erp/)**

## Empezar

```bash
make install   # dependencias
make up        # levanta db + api + web
```

| Servicio | Dirección |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Estado del sistema | http://localhost:3001/health |

`make help` lista todos los comandos disponibles.

## Pruebas

```bash
make test-unit      # dominio, sin base de datos
make test-e2e       # Playwright: API, interfaz y resiliencia
make verify         # todo lo que corre el CI
make verify-clean   # igual, simulando un clon limpio
```

`make verify` antes de cada push. `make verify-clean` cuando toques Dockerfiles,
dependencias o configuración de compilación: borra todo el código generado y
reconstruye las imágenes sin caché, que es lo único que reproduce de verdad lo
que hace el CI sobre un repositorio recién clonado.

> Documentación completa en construcción. Plan del proyecto en [`docs/PLAN.md`](docs/PLAN.md).
