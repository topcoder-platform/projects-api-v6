# Differences from v5

This document summarizes intentional differences and improvements in `project-service-v6` relative to `tc-project-service` (`/v5`).

## Removed Features

- Elasticsearch-backed read paths were removed; reads now use PostgreSQL via Prisma.
- Timeline and milestone CRUD endpoints are not migrated (see `docs/timeline-milestone-migration.md`).
- Deprecated endpoint families were not ported:
  - scope change requests
  - reports
  - customer payments
  - phase members and phase approvals
  - estimation item routes
- Admin Elasticsearch maintenance endpoints were removed.

## API Changes

- API prefix changed from `/v5` to `/v6`.
- Work management permission routes use query-parameter lookup patterns for consistency:
  - `/v6/projects/metadata/workManagementPermission?projectTemplateId=:id`
  - `/v6/projects/metadata/workManagementPermission?id=:id`
- Invite creation uses partial-success response semantics:
  - `{ success: Invite[], failed: ErrorInfo[] }`

## Authorization Improvements

- Member and invite operations use more granular named permissions.
- M2M scope hierarchy and aliases are normalized (`all:project`, `all:connect_project`, `all:*`).
- Permission checks are centralized through Nest guards/decorators (`PermissionGuard`, `@RequirePermission`).

## Event Publishing Changes

- Event originator changed from `tc-project-service` to `project-service-v6`.
- Event payload contracts are documented in `docs/event-schemas.md`.
- Conditional publishing logic is explicit:
  - status-change events are emitted only when status changes
  - notification topics are emitted based on changed fields

## Performance and Data Access

- Prisma-based query layer replaced Sequelize.
- Relation includes are explicit, reducing N+1 query patterns.
- Connection behavior is standardized through Prisma pool management and environment configuration.

## Code Quality Improvements

- TypeScript-first service implementation with stronger typing.
- NestJS modular architecture with dependency injection.
- DTO validation using `class-validator` and global validation pipe.
- Swagger documentation generated from route-level decorators.

## Migration Impact Summary

- Consumers must switch from `/v5/projects` to `/v6/projects`.
- Some legacy and deprecated endpoints are intentionally unavailable.
- Core P0 consumer flows remain API-compatible for response shape, authorization behavior, and event contracts.
