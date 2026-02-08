# Migration Runbook: `tc-project-service` -> `project-service-v6`

## Scope

This runbook covers migration of actively used `/v5/projects` API surface to `/v6/projects` with compatibility validation, phased rollout, and rollback procedures.

## Pre-Migration Checklist

- Confirm all P0 endpoints are implemented and passing compatibility tests:
  - projects CRUD/list
  - billing lookups
  - members
  - invites
  - attachments
  - phases/products
  - copilot requests/opportunities/applications
- Run response schema parity tests and authorization parity tests.
- Run event payload validation tests against documented event schemas.
- Run load tests and confirm p95/error budget targets are met.
- Run database compatibility tests against a production-like snapshot.
- Confirm CircleCI deployment jobs and deployment-validation jobs are green.
- Ensure monitoring dashboards exist for:
  - API availability
  - p50/p95/p99 latency
  - 4xx/5xx rate
  - event publishing failures
  - DB query latency
  - connection pool pressure

## Migration Steps

1. Deploy `project-service-v6` to DEV.
2. Run smoke tests against DEV deployment (`pnpm test:deployment` with deployment flags).
3. Update consuming services to call `/v6/projects`:
   - `work-manager`
   - `platform-ui`
   - `challenge-api-v6`
   - `engagements-api-v6`
4. Monitor DEV for 48 hours.
5. Deploy `project-service-v6` to PROD using blue-green strategy.
6. Route 10% traffic to v6.
7. Monitor errors/latency/event delivery for at least 2 hours.
8. Increase to 50% traffic.
9. Monitor again and increase to 100% traffic when stable.
10. Keep `tc-project-service` running for 7 days as fallback.
11. Decommission `tc-project-service` after fallback window completes.

## Rollback Procedures

### Immediate rollback

- Switch traffic back to `tc-project-service` at the load balancer or service routing layer.
- Confirm rollback by running smoke checks on `/v5/projects/health` and key P0 endpoints.

### Database rollback

- Not required for this migration path because schema remains compatible.
- If emergency schema issue is detected, halt rollout and restore from DB snapshot following platform DB SOP.

### Event replay

- Identify failed publish window from logs/metrics.
- Re-run event replay tooling for missed topics (BUS API/Kafka replay process).
- Validate replay completion using consumer lag + downstream audit checks.

## Monitoring and Validation

### Must-watch metrics

- API success rate and 5xx rate (`/v6/projects/*`)
- Response latency (p50, p95, p99)
- DB query latency and pool saturation
- Event publishing success/failure rate
- Consumer lag for downstream event consumers

### Recommended alerts

- 5xx rate > 2% for 5 minutes
- p95 latency > 2.5s for 10 minutes
- event publish failures > 0.5% for 5 minutes
- DB pool saturation > 85%

### Post-cutover validation queries

- Compare `/v5` vs `/v6` response shape snapshots for key P0 routes.
- Validate invite/member counts for actively edited projects.
- Validate recent project status transitions generated expected events.

## Known Differences

- Elasticsearch-backed reads removed; PostgreSQL is the source for reads.
- Timeline/milestone CRUD endpoints are intentionally not migrated.
- Deprecated endpoints are not ported:
  - scope change requests
  - reports
  - customer payments
  - phase members/approvals
  - estimation items
- API prefix changed from `/v5` to `/v6`.

## Execution Commands

```bash
cd project-service-v6

# Full e2e
pnpm test:e2e

# Target suites
pnpm test:e2e -- response-schema-validation
pnpm test:e2e -- authorization-parity
pnpm test:e2e -- event-payload-validation

# Load tests
pnpm test:load

# Deployment validation
pnpm test:deployment
```

## Sign-Off

- Engineering owner sign-off
- QA sign-off
- SRE/Platform sign-off
- Product owner sign-off
