# Kafka Listener Audit for `projects-api-v6` Topics

Date: 2026-03-04  
Scope: all top-level services/apps in this monorepo.  
Excluded per request: `projects-api-v6`, `tc-project-service`.

## Active topics in `projects-api-v6/.env.example`

- `project.created`
- `project.updated`
- `project.action.billingAccount.update`
- `project.deleted`
- `project.member.added`
- `project.member.removed`

## Confirmed listeners (outside excluded services)

No non-excluded service in this monorepo statically subscribes to these topics.

## Topic-by-topic matrix

| Env Variable | Topic | Confirmed Listener(s) | Confirmed Usage |
|---|---|---|---|
| `KAFKA_PROJECT_CREATED_TOPIC` | `project.created` | None found | N/A |
| `KAFKA_PROJECT_UPDATED_TOPIC` | `project.updated` | None found | N/A |
| `KAFKA_PROJECT_BILLING_ACCOUNT_UPDATED_TOPIC` | `project.action.billingAccount.update` | None found | N/A |
| `KAFKA_PROJECT_DELETED_TOPIC` | `project.deleted` | None found | N/A |
| `KAFKA_PROJECT_MEMBER_ADDED_TOPIC` | `project.member.added` | None found | N/A |
| `KAFKA_PROJECT_MEMBER_REMOVED_TOPIC` | `project.member.removed` | None found | N/A |

## Runtime caveat

`tc-email-service` subscribes dynamically via runtime `TEMPLATE_MAP` keys. Those values are not committed in this monorepo, so runtime subscriptions cannot be proven from source alone.
