# syntax=docker/dockerfile:1

FROM node:22.13.1-alpine

RUN apk add --no-cache bash git

ARG RESET_DB_ARG=false
ENV RESET_DB=$RESET_DB_ARG
ARG SEED_DATA_ARG=""
ENV SEED_DATA=$SEED_DATA_ARG
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

WORKDIR /app
COPY --chown=node:node . .
RUN npm install pnpm -g
RUN pnpm install
RUN pnpm run build
RUN chmod +x appStartUp.sh

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/v6/projects/health" || exit 1

CMD ["./appStartUp.sh"]
