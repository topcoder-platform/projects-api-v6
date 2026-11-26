# syntax=docker/dockerfile:1

ARG NODE_VERSION=26.13.1
ARG ALPINE_VERSION=3.24

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS toolchain

ARG PNPM_VERSION=11.15.1

ENV CI=true
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
WORKDIR /app

RUN apk upgrade --no-cache \
  && apk add --no-cache git openssh-client openssl \
  && npm install --global "pnpm@${PNPM_VERSION}" \
  && npm cache clean --force

FROM toolchain AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nest-cli.json tsconfig.json tsconfig.build.json \
  eslint.config.mjs .prettierrc ./
COPY packages/projects-prisma-client/package.json ./packages/projects-prisma-client/package.json
COPY tools ./tools
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm lint \
  && pnpm test --runInBand \
  && pnpm test:dependency-compat \
  && pnpm build

# Install only the application importer. The published client workspace has its own build-time peers.
FROM toolchain AS runtime-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY tools ./tools
COPY prisma ./prisma
RUN pnpm install --prod --frozen-lockfile

FROM alpine:${ALPINE_VERSION}@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a AS production

ARG NODE_VERSION
ARG SEED_DATA_ARG=""

ENV NODE_ENV=production
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
ENV SEED_DATA=$SEED_DATA_ARG
WORKDIR /app

RUN apk upgrade --no-cache \
  && apk add --no-cache 'libcrypto3>=3.5.9-r1' 'libssl3>=3.5.9-r1' bash 'nodejs-current~26.13.1' "zlib>=1.4-r0" openssl \
  && test "$(node -p 'process.versions.node')" = "${NODE_VERSION}" \
  && addgroup --system --gid 10001 app \
  && adduser --system --disabled-password --no-create-home --uid 10001 --ingroup app app

COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=runtime-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app --chmod=755 /app/appStartUp.sh ./appStartUp.sh

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/v6/projects/health" || exit 1

CMD ["./appStartUp.sh"]
