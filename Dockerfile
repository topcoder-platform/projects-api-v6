# syntax=docker/dockerfile:1

ARG NODE_VERSION=26.5.0
ARG ALPINE_VERSION=3.23

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
COPY patches ./patches
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm lint \
  && pnpm build \
  && pnpm prune --prod --ignore-scripts

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS production

ARG RESET_DB_ARG=false
ARG SEED_DATA_ARG=""

ENV NODE_ENV=production
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
ENV RESET_DB=$RESET_DB_ARG
ENV SEED_DATA=$SEED_DATA_ARG
WORKDIR /app

RUN apk upgrade --no-cache \
  && apk add --no-cache bash openssl \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node --chmod=755 /app/appStartUp.sh ./appStartUp.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/v6/projects/health" || exit 1

CMD ["./appStartUp.sh"]
