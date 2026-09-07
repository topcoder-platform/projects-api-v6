# Dependency Security and Maintenance

## Overview

This document records the dependency and production-image posture for the
`projects-api-v6` security candidate rebuilt from the repository's `dev`
lineage.

Toolchain used for this verification cycle:

- Node: `v26.5.1`
- pnpm: `10.28.2`
- Prisma CLI, client, and PostgreSQL adapter: `7.9.0`
- Verification date: `2026-09-01`

Run `nvm use` from this project directory before each Node or pnpm command.
The standard verification commands are:

```bash
pnpm audit
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
| Node.js | 26.5.1 |
| NestJS common, core, platform, and testing | 11.1.28 |
| NestJS Swagger | 11.4.6 |
| Prisma CLI, client, and PostgreSQL adapter | 7.9.0 |
| AWS SDK S3 client and request presigner | 3.1090.0 |
| Axios | 1.18.1 |
| Lodash | 4.18.1 |
| qs | 6.15.3 |
| UUID | 14.0.1 |

`pnpm-workspace.yaml` constrains vulnerable transitive ranges for Axios, Babel,
Body Parser, Fast URI, Fast XML Parser, Hono's Node server, Multer,
Path-to-RegExp, file-type, form-data, js-yaml, brace-expansion, Handlebars, Joi,
Piscina, UUID, archive utilities, and related packages. The generated lockfile
is the authoritative record of their resolved versions. The September 2026
security refresh resolves `brace-expansion` 5.0.9, `deepmerge-ts` 8.0.0,
`fast-uri` 4.1.2, `find-my-way` 9.7.0, `js-yaml` 3.15.1/4.3.1/5.2.2, and
`valibot` 1.4.2.

Prisma 7.9.0 currently prints an upstream support-list warning under Node 26.
The four committed external generated clients also retain their existing Prisma
6.19.x runtimes. Client generation, lint, build, migrations, the primary health
query, and explicit connection queries through all four external clients are
verified with Node 26.5.1. Keep this compatibility point in deployment QA until
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

This repository also publishes its own generated client as the GitHub
subdirectory package `@topcoder/projects-api-v6` from
`packages/projects-prisma-client`. Unlike the legacy Prisma 6 clients above,
the Projects package is generated and pinned with Prisma 7.9.0. Its exported
`createProjectsPrismaClient(connectionString, options?)` factory supplies the
required `@prisma/adapter-pg` instance for aggregators such as
`opportunities-api-v6`; callers own and disconnect the returned client.

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

The Dockerfile uses Node 26.5.1 for the build stage and installs Alpine's
dynamically linked Node 26.5.1 package into an Alpine 3.24 production stage.
The production stage contains only:

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
| `pnpm install --frozen-lockfile` | Passed in the production-image build; Prisma 7.9.0 client generated |
| `pnpm audit` | Passed: 0 critical, high, moderate, low, or informational advisories |
| `pnpm lint` | Passed |
| `pnpm build` | Passed |
| Targeted project/logger tests | Passed: 2 suites and 41 tests |
| `pnpm test --runInBand` | 49 of 60 suites and 380 of 395 tests passed; the same 10 existing event-publish mock expectations and 5 JWT fixture expectations remain stale on `dev` |
| Docker build and runtime inspection | Passed: non-root UID/GID 10001, Node 26.5.1, OpenSSL 3.5.8-r0, dynamic system SSL linkage, and no npm executable |
| Docker migration and health smoke test | Not repeated locally because it requires deployment database configuration; the migration entrypoint is unchanged |
| External generated-client query smoke | Not repeated because it requires external database configuration; the generated-client pins are unchanged from the previous passing cycle |
| Trivy 0.72.0 Critical/High/Medium image scan | Passed: 0 / 0 / 0 |
