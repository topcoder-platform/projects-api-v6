# Migration from `tc-project-service`

## Summary

This document maps legacy authorization logic from Express middleware to NestJS guards/decorators in `project-service-v6`.

## Key Differences

- Framework:
  - Old: Express middleware + ad-hoc util checks (`util.hasPermissionByReq`)
  - New: NestJS guards + metadata (`@RequirePermission`)
- Request context:
  - Old: `req.context.currentProjectMembers`
  - New: `request.projectContext.projectMembers` via `ProjectContextInterceptor`
- Permission checks:
  - Old: utility calls inside route handlers/middleware
  - New: `PermissionGuard` and specialized guards

## Policy Mapping

- `util.hasPermissionByReq(PERMISSION.X, req)`
  - New: `@UseGuards(PermissionGuard)` + `@RequirePermission(PERMISSION.X)`

- `permissions/copilotAndAbove.js`
  - New: `@UseGuards(CopilotAndAboveGuard)`

- Admin checks (`hasAdminRole`)
  - New: `@UseGuards(AdminOnlyGuard)`

- Project member checks
  - New: `@UseGuards(ProjectMemberGuard)`
  - Optional role filter: `@RequireProjectMemberRoles(...)`

## Endpoint Migration Pattern

1. Keep or port the same `PERMISSION.*` constant.
2. Replace inline permission logic with guard + decorator.
3. If route is project-scoped (`:projectId`), rely on project context interceptor and/or guard-side member loading.
4. Add unit/e2e tests for role, membership, and M2M scope paths.

## Notes on Scope Compatibility

`M2MService` now expands hierarchy and aliases, preserving compatibility with legacy expectations:

- `all:project` and `all:connect_project` are treated as equivalent.
- `all:*` scopes imply respective read/write scopes.

## Recommended Migration Checklist

1. Replace legacy middleware with Nest guards.
2. Add `@RequirePermission` where policy-level checks exist.
3. Confirm `JwtUser` carries expected `roles/scopes` claims.
4. Validate deny-rule behavior (`allow && !deny`) with tests.

## Member And Invite Endpoints (v5 -> v6)

- Members:
  - `POST /v5/projects/:projectId/members` -> `POST /v6/projects/:projectId/members`
  - `PATCH /v5/projects/:projectId/members/:id` -> `PATCH /v6/projects/:projectId/members/:id`
  - `DELETE /v5/projects/:projectId/members/:id` -> `DELETE /v6/projects/:projectId/members/:id`
  - `GET /v5/projects/:projectId/members` -> `GET /v6/projects/:projectId/members`
  - `GET /v5/projects/:projectId/members/:id` -> `GET /v6/projects/:projectId/members/:id`
- Invites:
  - `GET /v5/projects/:projectId/invites` -> `GET /v6/projects/:projectId/invites`
  - `POST /v5/projects/:projectId/invites` -> `POST /v6/projects/:projectId/invites`
  - `PATCH /v5/projects/:projectId/invites/:inviteId` -> `PATCH /v6/projects/:projectId/invites/:inviteId`
  - `DELETE /v5/projects/:projectId/invites/:inviteId` -> `DELETE /v6/projects/:projectId/invites/:inviteId`
  - `GET /v5/projects/:projectId/invites/:inviteId` -> `GET /v6/projects/:projectId/invites/:inviteId`

## Permission Changes

- Added member permissions:
  - `CREATE_PROJECT_MEMBER_OWN`
  - `CREATE_PROJECT_MEMBER_NOT_OWN`
  - `UPDATE_PROJECT_MEMBER_NON_CUSTOMER`
  - `DELETE_PROJECT_MEMBER_TOPCODER`
  - `DELETE_PROJECT_MEMBER_CUSTOMER`
  - `DELETE_PROJECT_MEMBER_COPILOT`
- Added invite permissions:
  - `CREATE_PROJECT_INVITE_TOPCODER`
  - `CREATE_PROJECT_INVITE_COPILOT`
  - `UPDATE_PROJECT_INVITE_REQUESTED`
  - `UPDATE_PROJECT_INVITE_NOT_OWN`
  - `DELETE_PROJECT_INVITE_REQUESTED`
  - `DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER`
  - `DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER`
  - `DELETE_PROJECT_INVITE_NOT_OWN_COPILOT`

## Removed Features

- Elasticsearch-backed member/invite reads were removed.
- Member and invite reads now use PostgreSQL directly via Prisma.

## Behavioral Notes

- Invite creation supports both `handles` and `emails` in one request.
- Email-only invites are restricted to `customer` role.
- Copilot invites can be `pending` or `requested` based on direct-invite permission.
- Invite accept/update flow can create project members and update copilot workflows in one transaction.
- Primary copilot deletion triggers automatic promotion of next active copilot.

## Consumer Migration Notes

- Continue using `fields` query parameter for optional member/invite enrichment.
- Invite create now returns `201` when at least one invite is created and still includes:
  - `{ success: Invite[], failed: ErrorInfo[] }`
- Compatibility `403` responses remain possible when no invite is created and the response only contains failures.
- If your integration relied on ES stale fields, switch to Member/Identity APIs for user metadata.
