# Build context: repo root

FROM node:24-bookworm-slim AS base
RUN npm install -g pnpm@11.21.0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm config set store-dir /pnpm/store
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/medfolio-api/package.json ./apps/medfolio-api/package.json
COPY apps/medfolio/package.json ./apps/medfolio/package.json
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter medfolio-api...

FROM deps AS build
COPY apps/medfolio-api ./apps/medfolio-api
RUN pnpm --filter medfolio-api build

FROM build AS deploy
RUN --mount=type=cache,target=/pnpm/store \
    pnpm deploy --filter=medfolio-api --prod --legacy /prod/api && \
    cp -r apps/medfolio-api/dist /prod/api/dist

FROM node:24-bookworm-slim AS prod
WORKDIR /app
COPY --from=deploy /prod/api ./
USER node
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main"]
