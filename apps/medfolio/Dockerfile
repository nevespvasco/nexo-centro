# Build context: repo root

FROM node:24-bookworm-slim AS base
RUN npm install -g pnpm@11.21.0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm config set store-dir /pnpm/store
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/medfolio/package.json ./apps/medfolio/package.json
COPY apps/medfolio-api/package.json ./apps/medfolio-api/package.json
COPY packages/schemas/package.json ./packages/schemas/package.json
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter medfolio...

FROM deps AS build
COPY packages/schemas ./packages/schemas
COPY apps/medfolio ./apps/medfolio
RUN pnpm --filter medfolio... build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS prod
COPY --from=build /app/apps/medfolio/dist /usr/share/nginx/html
COPY apps/medfolio/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
