# Contexto de construccion: la RAIZ del monorepo, no esta carpeta.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Todo lo que necesita el postinstall (`prisma generate`) va ANTES del install.
# tsconfig.json incluido: el generador lo lee para decidir la extension de los
# imports del cliente (.js con nodenext). Sin el emite .ts y la imagen no arranca.
COPY apps/api/package.json apps/api/tsconfig.json apps/api/prisma7.config.ts ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api ./apps/api
RUN pnpm --filter api build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
# Sin scripts: aqui no se genera nada y el CLI de prisma no esta (es de desarrollo).
RUN pnpm install --frozen-lockfile --prod --filter api... --ignore-scripts
# @prisma/client declara `prisma` y `typescript` como pares OPCIONALES, y pnpm
# los resuelve por estar en el workspace. Con driver adapter no se usan en
# ejecucion: fuera, junto con su arbol. mysql2 y deepmerge-ts tambien son de la CLI:
# no se ejecutan, pero un escaner los marcaria dentro de la imagen.
RUN rm -rf node_modules/.pnpm/prisma@* \
           node_modules/.pnpm/typescript@* \
           node_modules/.pnpm/@prisma+studio-core@* \
           node_modules/.pnpm/@prisma+engines@* \
           node_modules/.pnpm/effect@* \
           node_modules/.pnpm/@electric-sql+pglite@* \
           node_modules/.pnpm/elkjs@* \
           node_modules/.pnpm/react@* \
           node_modules/.pnpm/react-dom@* \
           node_modules/.pnpm/mysql2@* \
           node_modules/.pnpm/deepmerge-ts@*

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

# Sin root: si alguien escapa del proceso, no es administrador del contenedor.
USER node

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
