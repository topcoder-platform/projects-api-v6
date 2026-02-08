# Prisma Schema Notes

## Validation Summary
- `prisma validate` succeeded with Prisma CLI `6.17.1`.
- `prisma generate` succeeded and generated Prisma Client in `project-service-v6/node_modules/@prisma/client`.

## Database Introspection Status
`prisma db pull` was attempted against the two configured tc-project-service connection targets and failed due connectivity:

1. `postgres://coder:mysecretpassword@localhost:5432/projectsdb` -> `P1001: Can't reach database server at localhost:5432`
2. `postgres://coder:mysecretpassword@dockerhost:5432/projectsdb` -> `P1001: Can't reach database server at dockerhost:5432`

Because the database was unreachable, exact pull-time verification of nullability/defaults/index definitions/FK actions could not be completed in this environment.

## Basic Query Smoke Test
- Prisma client was generated successfully.
- A basic query (`prisma.project.count()`) was attempted with `DATABASE_URL=postgres://coder:mysecretpassword@localhost:5432/projectsdb`.
- Result: connection failure (`Can't reach database server at localhost:5432`), so runtime query verification is blocked pending DB availability.

## Prisma-Specific Adaptations
- `phase_work_streams` is modeled as an explicit junction model (`PhaseWorkStream`) to preserve the existing table. Prisma implicit many-to-many cannot target this custom table name.
- `project_phase_member` soft-delete partial uniqueness (`phaseId + userId` for active rows only) cannot be expressed directly in Prisma schema. A standard unique constraint (`@@unique([phaseId, userId])`) is used in schema representation.
- `ProjectAttachment.tags` and `ProjectAttachment.allowedUsers` are represented as scalar lists. Prisma schema does not model nullable list semantics distinctly from non-null lists.
- `CopilotRequest.projectId`, `CopilotOpportunity.projectId`, and `CopilotOpportunity.copilotRequestId` are nullable so `onDelete: SetNull` can be represented correctly.
- `StatusHistory` uses a generic `reference/referenceId` pattern. The Prisma relation to `Milestone` is modeled via `referenceId`; filtering by `reference = 'milestone'` remains an application-level concern.

## Follow-Up Needed Once DB Is Reachable
- Run `DATABASE_URL=<reachable_url> npx prisma@6.17.1 db pull --schema prisma/schema.prisma`.
- Diff pulled schema vs. current manual schema for:
  - BIGINT vs INT audit field types
  - nullable arrays and nullable FK columns
  - enum-backed vs string-backed status columns
  - partial indexes and cascade behaviors
- Apply any required alignment updates.
