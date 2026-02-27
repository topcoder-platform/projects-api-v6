# Dependency Security and Maintenance

## Overview

This document tracks dependency security posture and version drift for `projects-api-v6`.

Toolchain used for this verification cycle:

- Node: `v22.13.1`
- pnpm: `10.28.2`
- Verification date: `2026-02-20`

To re-run checks:

- `pnpm outdated`
- `pnpm audit`
- `pnpm lint`
- `pnpm build`

## Security Vulnerabilities

| CVE / Advisory | Severity | Package | Affected Versions | Fixed In | Status | Planned / Required Fix |
|---|---|---|---|---|---|---|
| GHSA-43fc-jf86-j433 | **HIGH** | `axios` | `<=0.30.2` and `>=1.0.0 <=1.13.4` | `>=0.30.3`, `>=1.13.5` | ✅ Cleared in production/transitive paths | Applied `pnpm.overrides.axios = 1.13.5`; verified `tc-core-library-js` now resolves `axios@1.13.5`. |
| GHSA-gq3j-xvxp-8hrf | **LOW** | `hono` | `<4.11.10` | `>=4.11.10` | ✅ Cleared | Updated `pnpm.overrides.hono` to `4.11.10`; Prisma transitive paths resolve `hono@4.11.10`. |
| GHSA-3ppc-4f35-3m26 | **HIGH** | `minimatch` | `<10.2.1` | `>=10.2.1` | ✅ Cleared | Added `pnpm.overrides.minimatch = 10.2.1`; audit no longer reports minimatch. |
| GHSA-2g4f-4pwh-qvx6 | **MODERATE** | `ajv` | `<8.18.0` | `>=8.18.0` | ✅ Cleared | Enforced `pnpm.overrides.ajv = 8.18.0` and added compatibility patches for `eslint@9.39.2` / `@eslint/eslintrc@3.3.3` to preserve lint behavior with Ajv v8. |
| CVE-2025-65945 | **HIGH** | `jws` (transitive via `jsonwebtoken`, `jwks-rsa`) | `<=3.2.2`, `4.0.0` | `3.2.3`, `4.0.1` | ✅ Cleared | Existing `jws` override retained (`>=3.2.3 <4.0.0 || >=4.0.1`). |

Current `pnpm audit` summary:

```text
No known vulnerabilities found
```

## Outdated Dependencies

Regenerated from `pnpm outdated` after dependency/security updates.

| Package | Specifier | Resolved | Latest | Notes |
|---|---|---|---|---|
| `@nestjs/common` | `^11.0.1` | `11.1.13` | `11.1.14` | Patch update available |
| `@nestjs/core` | `^11.0.1` | `11.1.13` | `11.1.14` | Patch update available |
| `@nestjs/platform-express` | `^11.0.1` | `11.1.13` | `11.1.14` | Patch update available |
| `@nestjs/testing` (dev) | `^11.0.1` | `11.1.13` | `11.1.14` | Patch update available |
| `@prisma/adapter-pg` | `7.4.0` | `7.4.0` | `7.4.1` | Patch update available |
| `@prisma/client` | `7.4.0` | `7.4.0` | `7.4.1` | Patch update available |
| `prisma` (dev) | `7.4.0` | `7.4.0` | `7.4.1` | Patch update available |
| `@aws-sdk/client-s3` | `^3.926.0` | `3.985.0` | `3.994.0` | Minor update available |
| `@aws-sdk/s3-request-presigner` | `^3.926.0` | `3.985.0` | `3.994.0` | Minor update available |
| `qs` | `^6.14.2` | `6.14.2` | `6.15.0` | Minor update available (currently security-pinned by override) |
| `typescript-eslint` (dev) | `^8.20.0` | `8.54.0` | `8.56.0` | Minor update available |
| `@eslint/js` (dev) | `^9.18.0` | `9.39.2` | `10.0.1` | Major update available |
| `@types/jest` (dev) | `^29.5.14` | `29.5.14` | `30.0.0` | Major update available |
| `@types/node` (dev) | `^22.10.7` | `22.19.9` | `25.3.0` | Major update available |
| `eslint` (dev) | `^9.18.0` | `9.39.2` | `10.0.0` | Major update available |
| `globals` (dev) | `^15.14.0` | `15.15.0` | `17.3.0` | Major update available |
| `jest` (dev) | `^29.7.0` | `29.7.0` | `30.2.0` | Major update available |
| `uuid` | `^11.1.0` | `11.1.0` | `13.0.0` | Major update available |
| `@swc/cli` (dev) | `^0.6.0` | `0.6.0` | `0.8.0` | Minor update available |

## GitHub-Sourced Packages (Supply-Chain Risk)

| Package | Specifier | Risk |
|---|---|---|
| `tc-bus-api-wrapper` | `github:topcoder-platform/tc-bus-api-wrapper.git` | GitHub source dependency; no semver release stream in npm |
| `tc-core-library-js` | `topcoder-platform/tc-core-library-js.git#master` | Floating `master` reference; transitive changes can land without semver |

## pnpm Overrides in Effect

| Override | Pinned To | Reason |
|---|---|---|
| `ajv` | `8.18.0` | Fix advisory GHSA-2g4f-4pwh-qvx6 across all transitive paths |
| `axios` | `1.13.5` | Force patched axios across transitive paths (`tc-core-library-js` included) |
| `fast-xml-parser` | `5.3.6` | Security hardening |
| `hono` | `4.11.10` | Fix advisory GHSA-gq3j-xvxp-8hrf |
| `jws` | `>=3.2.3 <4.0.0 \|\| >=4.0.1` | Fix CVE-2025-65945 |
| `lodash` | `4.17.23` | Prototype pollution fix |
| `minimatch` | `10.2.1` | Fix advisory GHSA-3ppc-4f35-3m26 |
| `qs` | `6.14.2` | Prototype pollution / DoS fix |

## pnpm Patched Dependencies

| Package | Patch File | Reason |
|---|---|---|
| `@eslint/eslintrc@3.3.3` | `patches/@eslint__eslintrc@3.3.3.patch` | Adapt Ajv initialization to work with enforced `ajv@8.18.0` |
| `eslint@9.39.2` | `patches/eslint@9.39.2.patch` | Replace Ajv v6-specific draft-04 path/API usage with Ajv v8-compatible behavior |

## Verification Log

Commands run in `projects-api-v6/` (with `nvm use` before each):

| Command | Result |
|---|---|
| `pnpm install` | ✅ Passed |
| `pnpm audit` | ✅ Passed (`No known vulnerabilities found`) |
| `pnpm outdated` | ✅ Completed (table above updated) |
| `pnpm lint` | ✅ Passed |
| `pnpm build` | ✅ Passed |
