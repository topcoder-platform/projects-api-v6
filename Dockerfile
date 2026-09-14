# syntax=docker/dockerfile:1

ARG NODE_VERSION=26.5.1
ARG ALPINE_VERSION=3.24

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS build

ARG PNPM_VERSION=10.28.2

ENV CI=true
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
WORKDIR /app

RUN apk upgrade --no-cache \
  && apk add --no-cache git openssh-client openssl \
  && npm install --global "pnpm@${PNPM_VERSION}" \
  && npm cache clean --force

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nest-cli.json tsconfig.json tsconfig.build.json \
  eslint.config.mjs .prettierrc ./
COPY packages/projects-prisma-client/package.json ./packages/projects-prisma-client/package.json
COPY patches ./patches
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm lint \
  && pnpm build \
  && pnpm prune --prod --ignore-scripts

FROM alpine:${ALPINE_VERSION} AS production

ARG NODE_VERSION
ARG RESET_DB_ARG=false
ARG SEED_DATA_ARG=""

ENV NODE_ENV=production
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
ENV RESET_DB=$RESET_DB_ARG
ENV SEED_DATA=$SEED_DATA_ARG
WORKDIR /app

RUN apk upgrade --no-cache \
  && apk add --no-cache bash nodejs-current="${NODE_VERSION}-r0" openssl \
  && addgroup --system --gid 10001 app \
  && adduser --system --disabled-password --no-create-home --uid 10001 --ingroup app app

COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app --chmod=755 /app/appStartUp.sh ./appStartUp.sh

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/v6/projects/health" || exit 1

CMD ["./appStartUp.sh"]
