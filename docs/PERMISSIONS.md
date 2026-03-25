# Permission System

## Overview

`project-service-v6` now uses a layered authorization system that ports the `tc-project-service` permission model into NestJS.

Flow:

1. `TokenRolesGuard` authenticates bearer JWT and sets `request.user`.
2. `ProjectContextInterceptor` loads project members (when `:projectId` exists) into `request.projectContext`.
3. Route guards (`PermissionGuard`, `AdminOnlyGuard`, `ProjectMemberGuard`, `CopilotAndAboveGuard`) authorize access.
4. Controllers can read `@CurrentUser()` and `@ProjectMembers()`.

Swagger auth notes:

- The Swagger `Authorization:` section now includes both auth-guard metadata and permission-derived summaries.
- Permission-derived summaries list allowed platform roles, allowed project member roles, pending-invite access, and permission-specific M2M scopes when applicable.

## Core Building Blocks

- Permission constants: `src/shared/constants/permissions.constants.ts`
- Permission service: `src/shared/services/permission.service.ts`
- Permission decorator: `src/shared/decorators/requirePermission.decorator.ts`
- Main permission guard: `src/shared/guards/permission.guard.ts`
- Project context interceptor: `src/shared/interceptors/projectContext.interceptor.ts`
- Enums:
  - `src/shared/enums/userRole.enum.ts`
  - `src/shared/enums/projectMemberRole.enum.ts`
  - `src/shared/enums/scopes.enum.ts`

## Talent Manager Behavior

- `Talent Manager` and `Topcoder Talent Manager` satisfy `CREATE_PROJECT_AS_MANAGER`, so project creation persists them as the primary `manager` project member.
- The same Talent Manager roles also satisfy the `manager` project-role validation used by member add/update/invite flows, so they can be granted `Full Access` from Work Manager's Users tab.
- That primary `manager` membership then unlocks the standard manager-level project-owner paths, such as edit and delete checks that rely on project-member context.
- `Talent Manager` and `Topcoder Talent Manager` also qualify for the elevated `GET /v6/projects/:projectId/permissions` response, which keeps Work Manager's challenge-provisioning matrix aligned with project-manager access.

## Billing Account Editing

- `MANAGE_PROJECT_BILLING_ACCOUNT_ID` is intentionally narrower than general project edit access.
- A caller may set or update `billingAccountId` only when they are a human admin (`Connect Admin`, `administrator`, or `tgadmin`) or they are an active `manager` member on that specific project.
- Global manager, project-manager, task-manager, talent-manager, or M2M-only access is not enough on its own to edit a project's billing account.

## Permission Rule Shape

Supported shapes:

- Simplified allow rule:

```ts
{
  topcoderRoles: [UserRole.TOPCODER_ADMIN],
  projectRoles: [ProjectMemberRole.MANAGER],
  scopes: [Scope.PROJECTS_READ],
}
```

- Full allow + deny rule:

```ts
{
  allowRule: {
    topcoderRoles: true,
  },
  denyRule: {
    topcoderRoles: [UserRole.TOPCODER_USER],
  },
}
```

Rule evaluation is `allow && !deny`, while each rule itself uses OR semantics across `topcoderRoles`, `projectRoles`, and `scopes`.

## Route Usage

### Permission constants with `PermissionGuard`

```ts
@UseGuards(PermissionGuard)
@RequirePermission(PERMISSION.READ_PROJECT)
@Get(':projectId')
getProject() {}
```

### Multiple permissions (OR)

```ts
@UseGuards(PermissionGuard)
@RequirePermission(PERMISSION.READ_PROJECT_ANY, PERMISSION.READ_PROJECT)
@Get(':projectId/details')
getProjectDetails() {}
```

### Admin-only endpoint

```ts
@UseGuards(AdminOnlyGuard)
@Delete(':projectId')
removeProject() {}
```

### Project member endpoint

```ts
@UseGuards(ProjectMemberGuard)
@Get(':projectId/members/me')
getMyMembership() {}
```

With role restriction:

```ts
@UseGuards(ProjectMemberGuard)
@RequireProjectMemberRoles(ProjectMemberRole.MANAGER, ProjectMemberRole.COPILOT)
@Patch(':projectId/workstreams/:workId')
updateWorkstream() {}
```

## M2M Scope Behavior

`M2MService` supports hierarchy and alias expansion:

- `all:projects` includes `read:projects` and `write:projects`
- `all:project-members` includes `read:project-members` and `write:project-members`
- `all:project-invites` includes `read:project-invites` and `write:project-invites`
- `all:customer-payments` includes read/write customer payment scopes
- `all:connect_project` is super-scope for all project-related scopes
- alias support: `all:project` === `all:connect_project`

## Available Permission Constants

All constants from `tc-project-service/src/permissions/constants.js` are available in:

- `PERMISSION`
- `PROJECT_TO_TOPCODER_ROLES_MATRIX`
- `DEFAULT_PROJECT_ROLE`

## Adding a New Permission

1. Add the permission entry to `src/shared/constants/permissions.constants.ts`.
2. Reuse existing enums from `src/shared/enums/*`.
3. Protect routes with `@UseGuards(PermissionGuard)` and `@RequirePermission(...)`.
4. Add unit tests in `permission.service.spec.ts` and guard tests if route behavior is custom.
