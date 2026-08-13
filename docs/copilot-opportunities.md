# Copilot opportunity discovery

`GET /v6/projects/copilots/opportunities` is the canonical marketplace listing
used by the Opportunities experience. It remains public and returns the legacy
bare response array. Filtering, total count, stable sorting, offset, and limit
are performed in PostgreSQL before the selected page's relations are loaded.

## Query parameters

| Parameter | Type/default | Behavior |
| --- | --- | --- |
| `page` | integer, `1` | One-based page number. |
| `pageSize` | integer, `20`, max `200` | Page size. `perPage` is a compatibility alias. |
| `sort` | string, `createdAt desc` | `createdAt`, `updatedAt`, `status`, `type`, `projectName`, `opportunityTitle`, or `startDate`, followed by `asc` or `desc`. |
| `noGrouping` | boolean, `false` | When false, preserve legacy status grouping: active, canceled, completed. |
| `search` | string, max 200 | Case-insensitive match over title, overview, project name, type, and skills. `keyword` is an alias. |
| `status` | string list | `active`, `completed`, and/or `canceled`. Comma-separated, repeated, and `status[$in]` bracket forms are accepted. |
| `projectId` | numeric string | Exact project id. |
| `projectName` | string, max 200 | Case-insensitive partial project name. |
| `type` | string list | `dev`, `qa`, `design`, `ai`, and/or `datascience`. `projectType` is an alias. |
| `skills` | string list, max 50 | Match any request skill id or name, case-insensitively. `skill` is an alias. |
| `startDateFrom`, `startDateTo` | ISO date/date-time | Inclusive requested-start range stored in request data. Date-only upper bounds include the full UTC day. |
| `createdAtFrom`, `createdAtTo` | ISO date/date-time | Inclusive opportunity creation range. |
| `applied` | boolean | Whether the current authenticated user has a non-deleted application. |
| `myApplications` | boolean | Compatibility shortcut for `applied=true`; false leaves the list unfiltered. |
| `applicationStatus` | string list | Current-user application states: `pending`, `invited`, `accepted`, `canceled`. Implies `applied=true`. |

`applied`, `myApplications=true`, and `applicationStatus` require an
authenticated principal with a numeric Topcoder user id and return `401` when
that context is unavailable. `applicationStatus` cannot be combined with
`applied=false`. Anonymous requests remain supported. When an Authorization
header is supplied, it is validated so the response can include caller-specific
state; malformed or invalid supplied credentials return `401`.

Example:

```http
GET /v6/projects/copilots/opportunities?page=1&pageSize=12&status=active&type=dev,ai&skills=Node.js,React&startDateFrom=2026-08-01&sort=startDate%20asc&myApplications=true
Authorization: Bearer <jwt>
```

## Response

The body remains an array for compatibility:

```json
[
  {
    "id": "21",
    "copilotRequestId": "11",
    "status": "active",
    "type": "dev",
    "createdAt": "2026-08-01T00:00:00.000Z",
    "updatedAt": "2026-08-02T00:00:00.000Z",
    "opportunityTitle": "Lead the delivery team",
    "projectType": "dev",
    "overview": "Delivery overview",
    "skills": [{ "id": "1", "name": "Node.js" }],
    "startDate": "2026-08-15T00:00:00.000Z",
    "numWeeks": 8,
    "tzRestrictions": "UTC-5 to UTC+2",
    "numHoursPerWeek": 20,
    "canApplyAsCopilot": true,
    "hasApplied": true,
    "currentUserApplication": {
      "id": "31",
      "status": "pending",
      "createdAt": "2026-08-03T00:00:00.000Z",
      "updatedAt": "2026-08-03T00:00:00.000Z"
    }
  }
]
```

Request data continues to be flattened into each result, preserving existing
fields such as `copilotUsername`, `complexity`, `requiresCommunication`,
`paymentType`, and `otherPaymentType`. `hasApplied` and
`currentUserApplication` are included when a numeric authenticated user id is
available. Admin and manager responses retain the minimal `projectId` and
`project: { name }` metadata previously exposed.

Pagination metadata is returned in `X-Page`, `X-Per-Page`, `X-Total`, and
`X-Total-Pages`. `X-Prev-Page`, `X-Next-Page`, and RFC 5988-style `Link` headers
are included when applicable. All pagination headers are exposed through CORS.

## Detail aliases

Both routes resolve the same detail response:

- `GET /v6/projects/copilot/opportunity/:id`
- `GET /v6/projects/copilots/opportunity/:id`

The detail includes the same flattened fields and current-user application
summary as the list, plus `members`, the active project-member user-id list used
to calculate `canApplyAsCopilot`.
