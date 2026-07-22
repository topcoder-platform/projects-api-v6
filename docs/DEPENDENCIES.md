# Dependency Security and Maintenance

## Overview

This document records the dependency and production-image posture for the
`projects-api-v6` security candidate rebuilt from the repository's `dev`
lineage.

Toolchain used for this verification cycle:

- Node: `v26.5.0`
- pnpm: `10.28.2`
- Prisma CLI, client, and PostgreSQL adapter: `7.8.0`
- Verification date: `2026-07-20`

Run `nvm use` from this project directory before each Node or pnpm command.
The standard verification commands are:

```bash
pnpm audit --prod --audit-level=moderate
pnpm lint
pnpm build
pnpm test --runInBand
```

## Security status

The production dependency audit reports:

```text
No known vulnerabilities found
```

The remediated direct dependency set includes:

| Package group | Version |
| --- | --- |
| Node.js | 26.5.0 |
| NestJS common, core, platform, and testing | 11.1.28 |
| NestJS Swagger | 11.4.6 |
| Prisma CLI, client, and PostgreSQL adapter | 7.8.0 |
| AWS SDK S3 client and request presigner | 3.1090.0 |
| Axios | 1.18.1 |
| Lodash | 4.18.1 |
| qs | 6.15.3 |
| UUID | 14.0.1 |

`pnpm-workspace.yaml` constrains vulnerable transitive ranges for Axios, Hono,
Fast XML Parser, Multer, Path-to-RegExp, file-type, form-data, js-yaml,
brace-expansion, Joi, and related packages. The generated lockfile is the
authoritative record of their resolved versions.

Prisma 7.8.0 currently prints an upstream support-list warning under Node 26.
The four committed external generated clients also retain their existing Prisma
6.19.x runtimes. Client generation, lint, build, migrations, the primary health
query, and explicit connection queries through all four external clients are
verified with Node 26.5.0. Keep this compatibility point in deployment QA until
the applicable Prisma support messages explicitly include Node 26.

## External Prisma clients

The application imports generated Prisma clients for challenge, member,
resource, and standardized-skills data. Installing each source repository's
root package pulled its entire API dependency graph into this service even
though none of that application code was used.

The dependencies now select only the committed generated-client subdirectory
from an immutable repository commit:

| Dependency | Commit | Installed path |
| --- | --- | --- |
| `@topcoder/challenge-api-v6` | `8ca7e4d065d15a077c648e4d04b85b73276cc078` | `packages/challenge-prisma-client` |
| `@topcoder/member-api-v6` | `a0ffd68bd7c63bbf525459b1e195d6d38ab26a91` | `packages/member-prisma-client` |
| `@topcoder/resource-api-v6` | `c64ffdccbed62533528dce55d33484be5e035d89` | `packages/resources-prisma-client` |
| `@topcoder/standardized-skills-api` | `012bf813583f80ec1dad014824ebb4d0bd434439` | `packages/skills-prisma-client` |

This preserves the exact generated clients used by the `dev` lineage while
excluding unrelated service dependencies and lifecycle scripts. These generated
packages contain Prisma 6.19.x runtimes; each client is connection/query
smoke-tested under Node 26 in addition to the application's Prisma 7 health
check.

## Other Git dependencies

The remaining Topcoder libraries are pinned to immutable commits:

| Package | Commit |
| --- | --- |
| `tc-bus-api-wrapper` | `297a9c0adcdb97661257e7825bee9c3f5578b833` |
| `tc-core-library-js` | `1075136355e1e1c4779f2138a30f3ffbd718bfa4` |

The wrapper's own `tc-core-library-js#master` dependency is overridden to the
same immutable core-library archive, preventing lockfile regeneration from
advancing that transitive ref. Publishing these libraries to a controlled
package registry would further reduce reliance on Git-hosted installation.

## Production image

The Dockerfile uses separate build and production stages on Node 26.5.0 with
Alpine 3.23. The production stage contains only:

- compiled application output;
- production dependencies;
- the Prisma CLI, configuration, schema, and migrations;
- the startup script required to deploy migrations before listening.

Development tooling and npm/npx are not copied into the final image. The
startup script invokes the local Prisma CLI directly and then uses `exec` for
the NestJS process, preserving ECS signal handling and migration behavior.

## Verification log

Update this table whenever dependency or image contents change.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; Prisma 7.8.0 client generated |
| `pnpm audit --prod --audit-level=moderate` | Passed: no known vulnerabilities |
| `pnpm lint` | Passed |
| `pnpm build` | Passed |
| `pnpm test --runInBand` | 46 of 57 suites and 360 of 375 tests passed; 10 existing event-publish mock expectations and 5 JWT fixture expectations remain stale on `dev` |
| Docker migration and health smoke test | Passed: 3 migrations applied, server remained running, and `/v6/projects/health` returned `{"checksRun":1}` |
| External generated-client query smoke | Passed for challenge, member, resource, and skills clients under Node 26.5.0 |
| Trivy 0.72.0 Critical/High/Medium image scan | Passed: 0 / 0 / 0 |
