# Contexto de construccion: la RAIZ del monorepo, no esta carpeta.
# El lockfile y la definicion del workspace viven alli.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api ./apps/api
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

# Instalacion aparte solo con dependencias de ejecucion.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --prod --filter api...
# @prisma/client declara `prisma` y `typescript` como pares OPCIONALES, y pnpm
# los resuelve por estar en el workspace. Con driver adapter no se usan en
# ejecucion: fuera, junto con su arbol.
RUN rm -rf node_modules/.pnpm/prisma@* \
           node_modules/.pnpm/typescript@* \
           node_modules/.pnpm/@prisma+studio-core@* \
           node_modules/.pnpm/@prisma+engines@* \
           node_modules/.pnpm/effect@* \
           node_modules/.pnpm/@electric-sql+pglite@* \
           node_modules/.pnpm/elkjs@* \
           node_modules/.pnpm/react@* \
           node_modules/.pnpm/react-dom@*

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
