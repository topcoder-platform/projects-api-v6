# Event Schemas

As of 2026-03-04, `projects-api-v6` publishes these Kafka topics:

- `project.created`
- `project.updated`
- `project.action.billingAccount.update`
- `project.deleted`
- `project.member.added`
- `project.member.removed`

## Envelope

All events are published through the event bus with this envelope shape:

```json
{
  "topic": "project.updated",
  "originator": "project-service-v6",
  "timestamp": "2026-02-08T00:00:00.000Z",
  "mime-type": "application/json",
  "payload": {
    "resource": "project",
    "data": {
      "id": "1001"
    }
  }
}
```

## Resource Mapping

- `project.created` -> `resource: "project"`
- `project.updated` -> `resource: "project"`
- `project.deleted` -> `resource: "project"`
- `project.member.added` -> `resource: "project.member"`
- `project.member.removed` -> `resource: "project.member"`

## Billing Account Update Event

`project.action.billingAccount.update` follows the legacy tc-project-service
payload contract and is intentionally published **without** `resource/data`
wrapping:

```json
{
  "topic": "project.action.billingAccount.update",
  "originator": "project-service-v6",
  "timestamp": "2026-03-04T00:00:00.000Z",
  "mime-type": "application/json",
  "payload": {
    "projectId": "1001",
    "projectName": "Demo Project",
    "directProjectId": null,
    "status": "active",
    "oldBillingAccountId": "11",
    "newBillingAccountId": "22"
  }
}
```

## Notes

- `project.action.billingAccount.update` is emitted only when
  `billingAccountId` changes during `PATCH /v6/projects/:projectId`.
- Metadata event publishing is currently disabled.
