# Showcase metadata and WIN (PM-6329)

Apply `20260916000000_showcase_win_metadata` before deploying the application.
The migration adds nullable showcase content fields and a `sendToWin` boolean
defaulting to `false`. Existing posts remain readable and support partial updates.
The generated Prisma package is updated with the new fields.

## Shared project metadata

`Project.details` stores `customer`, `smu`, `smuOther`, and `dealCloseDate`.
Project create/update validates supplied values while accepting projects with no
showcase metadata. Strings are trimmed; Customer and custom SMU have a 255-character
limit. SMU accepts APMEA, Europe, Americas1, Americas2, or Others. Others requires
`smuOther`; a standard SMU clears a previous custom value. Dates must be valid
`YYYY-MM-DD` calendar dates (timestamps and impossible dates are rejected).

Post create/update accepts these four fields at the top level. They are merged
into the owning project's details, preserving unrelated keys. Create requires
complete metadata after merging with current project values. Enabling WIN also
requires complete project metadata and a valid showcase type. Both writes share
a transaction; the project row is locked before merging, and a failing post write
rolls back the project update. Every post response reads current metadata from the
project, so project edits are reflected by all its showcases.

## Showcase fields

| JSON field | Meaning |
| --- | --- |
| `type` | Required on create: Open Innovation, Private POD Delivery, Flexi-Talent Supply, AI Data Licensing |
| `challenge` | The Challenge, using the existing rich-text format |
| `content` | The Solution; preserves the existing required field |
| `businessImpact` | Business Impact Realised, using the same rich-text format |
| `keyWin` | Optional single-line summary, up to 255 characters |
| `currentStatus` | Delivered, In Delivery, On-Hold, Planned; empty string clears it |
| `owner` | Optional owner name/handle, up to 255 characters |
| `sendToWin` | Explicit boolean opt-in, default false |

Existing title, lifecycle status, taxonomy, challenge IDs, media and audit fields
retain their API names. Partial updates preserve omitted fields, including legacy
posts lacking a type. For example, media-only and publish/archive patches do not
require new metadata. Invalid supplied values return a validation error.

```json
{
  "title": "Customer delivery",
  "type": "Open Innovation",
  "customer": "Example customer",
  "smu": "Others",
  "smuOther": "Custom SMU",
  "dealCloseDate": "2026-09-16",
  "challenge": "The original problem",
  "content": "The delivered solution",
  "businessImpact": "The measured result",
  "keyWin": "Faster delivery",
  "currentStatus": "Delivered",
  "owner": "Owner name",
  "sendToWin": true,
  "industryIds": ["1"],
  "categoryIds": ["2"]
}
```

The reports API exposes opted-in, non-archived showcases for non-deleted projects
at `GET /v6/reports/WIN`. Its access requirement is `reports:win` scope or an
Administrator/Talent Manager user role. No outbound WIN push or credentials are
needed in this service. Deploy the migration/API before the UI and WIN report.

## Tests

After `nvm use`, run `pnpm lint`, `pnpm build`, and
`pnpm test --runInBand project-showcase-post showcase-metadata project.service`.
To include persistence/rollback tests, set `PROJECTS_TEST_DATABASE_URL` to a
disposable PostgreSQL database with this repository's migrations applied under
the `projects` schema. The integration tests remove their own project fixtures.
