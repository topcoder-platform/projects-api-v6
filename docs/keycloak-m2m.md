# Keycloak M2M migration branch

This code is isolated on `keycloak_m2M`. Do not deploy this branch until the
workload and its callers are ready. Existing DEV services continue using Auth0.
The core dependency is pinned to a reviewed Keycloak prerelease commit, including
transitive wrapper uses through the pnpm override. No npm latest dependency is used.
`pnpm-lock.yaml` resolves a single 4.0.0-keycloak.2 (core commit `112d54a`), for the
service and for `tc-bus-api-wrapper`'s copy.

## Provider switch: `USE_KEYCLOAK`

`USE_KEYCLOAK=true` makes this service get its M2M tokens from Keycloak, using
`KEYCLOAK_TOKEN_URL`, `KEYCLOAK_AUDIENCE`, `KEYCLOAK_CLIENT_ID` and
`KEYCLOAK_CLIENT_SECRET` (optional `KEYCLOAK_SCOPE` narrows the client's defaults).
`KEYCLOAK_ISSUER` is also required. Unset or `false` restores the Auth0 behaviour from
before the migration: `M2MService` (member, identity and billing-account lookups) and
both Bus publishers use `AUTH0_URL`, `AUTH0_AUDIENCE`, `AUTH0_PROXY_SERVER_URL`
(optional, defaults to `AUTH0_URL`), `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`.

The Bus publishers are `src/shared/utils/event.utils.ts` (project events) and
`EventBusService` (email and metadata events). Both get the wrapper's `AUTH0_*`
options from `auth.wrapperSettings`, and `EventBusService` reports and requires only
the active provider's settings. `tc-core-library-js` reads the flag
(`auth.useKeycloak`), so the service and the core always agree. Any value other than
`true`/`false` fails at startup. The Swagger M2M token example follows the flag too.
In DEV the flag is `/config/common/global-appvar/USE_KEYCLOAK`; the CircleCI deploy
loads that path, so no deployment file change is needed.

Incoming machine tokens: with `true`, Keycloak tokens are accepted, plus Auth0 tokens
while `LEGACY_M2M_ISSUERS`/`LEGACY_M2M_AUDIENCE` are set. With `false`, Auth0 tokens
are accepted through `LEGACY_M2M_*`, plus Keycloak tokens while `KEYCLOAK_ISSUER` and
`KEYCLOAK_AUDIENCE` are set, so callers that have not switched yet keep working.

**Rollback:** set `USE_KEYCLOAK=false` and force a new deployment so tasks re-read SSM.
No code or dependency change is needed. Keep the Auth0 settings above in SSM until
Keycloak has been accepted.

The DEV issuer is `https://keycloak.topcoder-dev.com/realms/topcoder-m2m-dev`,
audience `https://api.topcoder-dev.com`, and managed endpoint
`https://keycloak.topcoder-dev.com/m2m/token`.

Member sessions remain Auth0. Keep `VALID_ISSUERS` and `AUTH_SECRET` where legacy
member HMAC tokens are supported. Set `AUTH_USER_AUDIENCES` to a JSON array, or
explicitly retain existing user-token audience behavior with
`ALLOW_LEGACY_USER_AUDIENCE=true`. Never apply that exception to M2M tokens.
`LEGACY_M2M_ISSUERS` and `LEGACY_M2M_AUDIENCE` let Auth0 machine tokens pass the same
normalizer (see the provider switch above).

`tc-core-library-js` owns signature, issuer, audience, lifetime, and machine/user
classification. Service adapters must use its verified `kind`, `isMachine`, and
`scopes` rather than decode/reclassify claims. Scope guards delegate exact matching
to the library with explicit all/any policy. Existing business roles and documented
scope aliases remain endpoint policy; adding OAuth scopes to a user token never
grants machine access. No permissive fallback or synthetic token path is available.

Before rollout run this project's `nvm use`, `pnpm lint`, `pnpm build`, and targeted
authentication tests. Validate real authorized/unauthorized routes with both a
Keycloak service token and a member token, including wrong audiences and insufficient
scopes. Switch only after every downstream receiver accepts the issuer. The core never
retries a failed Keycloak request against Auth0; rolling back is the explicit
`USE_KEYCLOAK=false` change above.


The domain adapter retains string member IDs but never invents a member ID for a
service. `tokenPayload` contains the shared normalized principal. No raw scope,
permission, suffix-matched claim, or decoded-token fallback grants access.
Run `pnpm test:keycloak` after building to verify the compiled adapter.

Existing `SCOPE_HIERARCHY` and `SCOPE_SYNONYMS` remain explicit case-sensitive, one-way service policy: all may imply read/write, but read/write can never satisfy an all/admin requirement. Member role and project membership policies remain separate.

Validation: lint, build, and all six compiled authentication/scope checks pass. The
compiled adapter also accepted a real DEV Keycloak token. With the `USE_KEYCLOAK`
switch the full suite has 522 passing, three skipped, and ten failing metadata-event
expectations; `m2m-provider.spec.ts` covers both providers for every outbound path.
All ten failures reproduce on unchanged baseline `932a0485` with its original locked
dependencies (514 passing, three skipped, fifteen failing, including five old JWT
tests). No application service was deployed.
