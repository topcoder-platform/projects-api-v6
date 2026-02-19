# Event Schemas

As of 2026-02-08, `projects-api-v6` publishes only these Kafka topics:

- `project.created`
- `project.updated`
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

## Notes

- Legacy non-core event topics are removed from `projects-api-v6`.
- Metadata event publishing is currently disabled.
