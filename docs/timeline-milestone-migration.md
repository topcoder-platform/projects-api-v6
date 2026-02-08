# Timeline and Milestone Migration (Deferred)

## Decision

- Timeline and Milestone CRUD endpoints are intentionally not migrated to `/v6` at this time.
- Reason: API usage analysis found zero active callers in `work-manager`, `platform-ui`, `engagements-api-v6`, `challenge-api-v6`, and `community-app`.
- MilestoneTemplate metadata endpoints remain in place for admin metadata management.

## Reference Model (`reference` + `referenceId`)

- Timelines are associated to a parent entity through:
  - `reference`: parent type discriminator (for example, project/phase context)
  - `referenceId`: parent entity ID
- Permission checks should resolve the parent from `reference` + `referenceId`, then enforce project-membership and role policy.
- Request validation should normalize this mapping early (middleware/guard layer) and attach resolved project context for downstream authorization.

## Status History Tracking (Milestones)

- Milestone status changes should append immutable status history records.
- Create flow:
  - On milestone create, insert initial status history entry.
- Update flow:
  - On milestone update, append history only when `status` changes.
- Bulk update flow:
  - Process updates in a transaction.
  - For each row with status transition, append a status history row in the same transaction.

## Template-Based Milestone Generation Example

Example timeline create payload with template bootstrapping:

```json
{
  "name": "Execution Timeline",
  "description": "Delivery milestones for project launch",
  "reference": "phase",
  "referenceId": 12345,
  "templateId": 67,
  "startDate": "2026-02-01T00:00:00.000Z",
  "endDate": "2026-04-30T00:00:00.000Z"
}
```

Expected deferred behavior (when migrated in future):

1. Create timeline record.
2. Load milestone template rows by `templateId`.
3. Create milestones for the timeline from template defaults.
4. Create initial status history rows for each created milestone.
5. Publish timeline and milestone creation events for compatibility.

## Future Activation Checklist

1. Implement `/v6/timelines` CRUD module and DTOs.
2. Implement `/v6/timelines/:timelineId/milestones` CRUD + bulk update + status history.
3. Add permission middleware/guards using resolved project context.
4. Add event publishing for create/update/delete operations.
5. Add unit + integration coverage for template bootstrap, status history, permissions, and soft deletes.
