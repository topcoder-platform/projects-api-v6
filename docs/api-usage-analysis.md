# Project Service `/v5` API Usage Analysis

## Scope and Method

- **Source of truth for routes**: `tc-project-service/src/routes/index.js`
- **Consumer scan scope**: `work-manager`, `platform-ui` (copilots app), `engagements-api-v6`, `challenge-api-v6`, `community-app`
- **Classification**:
  - `used`: at least one in-repo caller found
  - `unused`: no in-repo caller found in this scan (route still active in legacy service)

## Priority Summary

- **P0 (must migrate first)**: project CRUD/listing, billing lookups, member/invite write flows, attachment file/link flows, phase-product linkage used by challenge flows, copilot request/opportunity flows
- **P1 (important but lower frequency)**: explicit list/read endpoints that are active but not currently called in-repo
- **P2 (unused in current repo)**: metadata/admin-style routes and legacy operational routes not called by scanned consumers

## `/v5` to `/v6` Mapping (Implemented)

| Legacy endpoint | New endpoint | Notes |
|---|---|---|
| `GET /v5/projects/:projectId/attachments` | `GET /v6/projects/:projectId/attachments` | Preserves allowed-user filtering behavior and member/admin access model. |
| `GET /v5/projects/:projectId/attachments/:id` | `GET /v6/projects/:projectId/attachments/:id` | Returns file attachments with presigned `url`; link attachments returned as-is. |
| `POST /v5/projects/:projectId/attachments` | `POST /v6/projects/:projectId/attachments` | Supports both `type: "file"` and `type: "link"` payloads; file flow returns `downloadUrl`. |
| `PATCH /v5/projects/:projectId/attachments/:id` | `PATCH /v6/projects/:projectId/attachments/:id` | Supports updating `title`, `description`, `allowedUsers`, `tags`, `path`. |
| `DELETE /v5/projects/:projectId/attachments/:id` | `DELETE /v6/projects/:projectId/attachments/:id` | Soft delete in DB and async S3 deletion for file attachments. |
| `GET /v5/projects/:projectId/phases` | `GET /v6/projects/:projectId/phases` | Supports `fields`, `sort`, and `memberOnly` query behavior. |
| `GET /v5/projects/:projectId/phases/:phaseId` | `GET /v6/projects/:projectId/phases/:phaseId` | Returns phase with optional nested relations (products/members/approvals). |
| `POST /v5/projects/:projectId/phases` | `POST /v6/projects/:projectId/phases` | Supports template bootstrap via `productTemplateId` and member assignment. |
| `PATCH /v5/projects/:projectId/phases/:phaseId` | `PATCH /v6/projects/:projectId/phases/:phaseId` | Supports partial phase updates with start/end date validation. |
| `DELETE /v5/projects/:projectId/phases/:phaseId` | `DELETE /v6/projects/:projectId/phases/:phaseId` | Soft delete for phase record. |
| `GET /v5/projects/:projectId/phases/:phaseId/products` | `GET /v6/projects/:projectId/phases/:phaseId/products` | Lists non-deleted phase products. |
| `GET /v5/projects/:projectId/phases/:phaseId/products/:productId` | `GET /v6/projects/:projectId/phases/:phaseId/products/:productId` | Returns a single non-deleted phase product. |
| `POST /v5/projects/:projectId/phases/:phaseId/products` | `POST /v6/projects/:projectId/phases/:phaseId/products` | Enforces max-per-phase count and inherits project billing/direct ids when omitted. |
| `PATCH /v5/projects/:projectId/phases/:phaseId/products/:productId` | `PATCH /v6/projects/:projectId/phases/:phaseId/products/:productId` | Supports partial updates to phase product fields. |
| `DELETE /v5/projects/:projectId/phases/:phaseId/products/:productId` | `DELETE /v6/projects/:projectId/phases/:phaseId/products/:productId` | Soft delete with compatibility event payload `{ id, projectId, phaseId }`. |
| `GET /v5/projects/:projectId/workstreams` | `GET /v6/projects/:projectId/workstreams` | Lists work streams. |
| `POST /v5/projects/:projectId/workstreams` | `POST /v6/projects/:projectId/workstreams` | Creates a work stream. |
| `GET /v5/projects/:projectId/workstreams/:id` | `GET /v6/projects/:projectId/workstreams/:id` | Returns a single work stream. |
| `PATCH /v5/projects/:projectId/workstreams/:id` | `PATCH /v6/projects/:projectId/workstreams/:id` | Updates a work stream. |
| `DELETE /v5/projects/:projectId/workstreams/:id` | `DELETE /v6/projects/:projectId/workstreams/:id` | Soft deletes a work stream. |
| `GET /v5/projects/:projectId/workstreams/:workStreamId/works` | `GET /v6/projects/:projectId/workstreams/:workStreamId/works` | Lists works linked to the work stream (`Work = ProjectPhase`). |
| `POST /v5/projects/:projectId/workstreams/:workStreamId/works` | `POST /v6/projects/:projectId/workstreams/:workStreamId/works` | Creates a phase and links it to the work stream. |
| `GET /v5/projects/:projectId/workstreams/:workStreamId/works/:id` | `GET /v6/projects/:projectId/workstreams/:workStreamId/works/:id` | Returns one linked work (`ProjectPhase`). |
| `PATCH /v5/projects/:projectId/workstreams/:workStreamId/works/:id` | `PATCH /v6/projects/:projectId/workstreams/:workStreamId/works/:id` | Updates one linked work (`ProjectPhase`). |
| `DELETE /v5/projects/:projectId/workstreams/:workStreamId/works/:id` | `DELETE /v6/projects/:projectId/workstreams/:workStreamId/works/:id` | Soft deletes one linked work (`ProjectPhase`). |
| `GET /v5/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems` | `GET /v6/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems` | Lists work items linked to the work (`WorkItem = PhaseProduct`). |
| `POST /v5/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems` | `POST /v6/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems` | Creates a linked work item (`PhaseProduct`). |
| `GET /v5/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems/:id` | `GET /v6/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems/:id` | Returns one linked work item (`PhaseProduct`). |
| `PATCH /v5/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems/:id` | `PATCH /v6/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems/:id` | Updates one linked work item (`PhaseProduct`). |
| `DELETE /v5/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems/:id` | `DELETE /v6/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems/:id` | Soft deletes one linked work item (`PhaseProduct`). |
| `GET /v5/projects/metadata/workManagementPermission` | `GET /v6/projects/metadata/workManagementPermission?projectTemplateId=:id` | Requires `projectTemplateId` filter. |
| `GET /v5/projects/metadata/workManagementPermission/:id` | `GET /v6/projects/metadata/workManagementPermission?id=:id` | Single-row lookup via query id. |
| `POST /v5/projects/metadata/workManagementPermission` | `POST /v6/projects/metadata/workManagementPermission` | Admin-only create. |
| `PATCH /v5/projects/metadata/workManagementPermission/:id` | `PATCH /v6/projects/metadata/workManagementPermission` | Admin-only update; target id is provided in body as `id`. |
| `DELETE /v5/projects/metadata/workManagementPermission/:id` | `DELETE /v6/projects/metadata/workManagementPermission?id=:id` | Admin-only soft delete via query id. |

## Work Management Notes

- `/v6` now includes the full work management route surface even though these routes are currently **unused** in the scanned consumers.
- Entity mapping intentionally reuses existing schema:
  - `WorkStream` maps to `work_streams`.
  - `Work` maps to `project_phases`.
  - `WorkItem` maps to `phase_products`.
  - `phase_work_streams` is the junction that links work streams and works.
- This keeps behavior aligned with `/v5` while avoiding duplicate domain models in `/v6`.

## P0 Endpoints (Used)

| Method | Path | Calling services | Query params (observed + supported) | Request body (observed) | Response shape (consumed) |
|---|---|---|---|---|---|
| GET | `/v5/projects` | `work-manager`, `platform-ui` | Observed: `sort`, `perPage`, `page`, `id`, `keyword`, `memberOnly`, `type[$in]`, `name`, `status[$in]`; supported filters in route: `id,status,memberOnly,keyword,type,name,code,customer,manager,directProjectId`, plus `fields` | none | `Project[]`; consumers read `id,name,type,status,lastActivityAt,details,billingAccountId`; pagination headers `X-Page`, `X-Per-Page`, `X-Total`, `X-Total-Pages` |
| GET | `/v5/projects/:projectId` | `work-manager`, `engagements-api-v6`, `challenge-api-v6`, `platform-ui` | Observed: none; supported: `fields` CSV | none | Project object with nested arrays (`members`, `invites`, `attachments`, optional `phases`); `engagements-api-v6` explicitly requires `members[]` + `invites[]` |
| POST | `/v5/projects` | `work-manager`, `challenge-api-v6` | none | Work Manager standard: `{name,description,type,status?,cancelReason?,groups?,terms[]}`; Work Manager TaaS: `{name,type,templateId,version,details,estimation[],attachments[]}`; Challenge API self-service: `{name,description,type}` | Created project object (`id`, core fields, nested data where provided) |
| PATCH | `/v5/projects/:projectId` | `work-manager`, `challenge-api-v6` | none | Work Manager: partial project fields incl. `billingAccountId`; Challenge API: status/details updates for payment lifecycle, plus name/description | Updated project object |
| GET | `/v5/projects/:projectId/billingAccounts` | `work-manager` | none | none | Billing account list from Salesforce mapping (consumed fields: `tcBillingAccountId`, `name`, `startDate`, `endDate`) |
| GET | `/v5/projects/:projectId/billingAccount` | `work-manager`, `challenge-api-v6` | none | none | Default billing account record (consumed: `tcBillingAccountId`, `startDate`, `endDate`, `active`; `markup` consumed by `challenge-api-v6` for M2M flow) |
| POST | `/v5/projects/:projectId/members` | `work-manager` | Optional `fields` supported | `{userId?, role}` (if `userId` omitted, current user is added) | Created member object (`id,projectId,userId,role,isPrimary,...` + optional member detail fields) |
| PATCH | `/v5/projects/:projectId/members/:id` | `work-manager` | Optional `fields` supported | `{role, isPrimary?, action?}`; `work-manager` uses `action: "complete-copilot-requests"` in one flow | Updated member object |
| DELETE | `/v5/projects/:projectId/members/:id` | `work-manager` | none | none | `204` |
| GET | `/v5/projects/:projectId/invites` | `work-manager` | `fields` CSV used by `work-manager` in invite-specific service; plain GET also used | none | Invite array (consumed: `id,projectId,userId,email,role,status,createdAt,updatedAt,handle`) |
| POST | `/v5/projects/:projectId/invites` | `work-manager` | `fields` CSV used by `work-manager` | `{handles?: string[], emails?: string[], role}` | `{success: Invite[], failed?: ErrorInfo[]}` pattern consumed by `work-manager` |
| PATCH | `/v5/projects/:projectId/invites/:inviteId` | `work-manager` | none | `{status, source?}` (`source` propagated from URL query in invite accept/decline page) | Updated invite object |
| DELETE | `/v5/projects/:projectId/invites/:inviteId` | `work-manager` | none | none | `204` |
| GET | `/v5/projects/:projectId/attachments/:id` | `work-manager` | none | none | Attachment metadata; for file attachments response includes presigned `url` used by UI download flow |
| POST | `/v5/projects/:projectId/attachments` | `work-manager` | none | Link: `{title,path,type:"link",tags[]}`; File: `{title,description,size,path,type:"file",contentType,s3Bucket,allowedUsers?,tags[]}` | Created attachment metadata (link) or file metadata + `downloadUrl` |
| PATCH | `/v5/projects/:projectId/attachments/:id` | `work-manager` | none | `{title,description?,allowedUsers?,tags?,path?}` | Updated attachment object |
| DELETE | `/v5/projects/:projectId/attachments/:id` | `work-manager` | none | none | `204` |
| GET | `/v5/projects/:projectId/phases` | `work-manager` | Observed: `fields=id,name,products,status`; supported: `fields`, `sort`, `memberOnly` | none | Phase array (consumed fields: `id,name,status,products[]`) |
| POST | `/v5/projects/:projectId/phases/:phaseId/products` | `work-manager` | none | `work-manager` sends generic milestone linkage payload: `{name:"Generic Product",type:"generic-product",templateId:67,estimatedPrice:1,actualPrice:1,details.challengeGuid:<challengeId>}` | Created phase-product object |
| DELETE | `/v5/projects/:projectId/phases/:phaseId/products/:productId` | `work-manager` | none | none | `204` |
| GET | `/v5/projects/copilots/requests` | `platform-ui` | `page`, `pageSize`, `sort` | none | Copilot request list (+ pagination headers) including `copilotOpportunity` relation and (for admin/PM) project data |
| GET | `/v5/projects/:projectId/copilots/requests` | `platform-ui` | `page`, `pageSize`, `sort` | none | Project-scoped copilot request list |
| GET | `/v5/projects/copilots/requests/:copilotRequestId` | `platform-ui` | none | none | Single copilot request including nested `data` payload and optional `copilotOpportunity` |
| POST | `/v5/projects/:projectId/copilots/requests` | `platform-ui` | none | `{data:{projectId,opportunityTitle,copilotUsername?,complexity,requiresCommunication,paymentType,otherPaymentType?,projectType,overview,skills[],startDate,numWeeks,tzRestrictions,numHoursPerWeek}}` | Created request object (`status` starts as `new`) |
| PATCH | `/v5/projects/copilots/requests/:copilotRequestId` | `platform-ui` | none | `{data:{...partial editable fields...}}` | Updated request object |
| POST | `/v5/projects/:projectId/copilots/requests/:copilotRequestId/approve` | `platform-ui` | none | `{type}` | Created copilot opportunity object |
| GET | `/v5/projects/copilots/opportunities` | `platform-ui`, `community-app` | `page`, `pageSize`, `sort`; `community-app` also sends `noGrouping=true` | none | Opportunity list derived from request `data`; public endpoint |
| GET | `/v5/projects/copilot/opportunity/:id` | `platform-ui` | none | none | Single opportunity details; includes flattened request fields, plus `members`, `canApplyAsCopilot`, and admin/manager-only `project` metadata |
| POST | `/v5/projects/copilots/opportunity/:id/apply` | `platform-ui` | none | `{notes}` | Created (or existing) copilot application object |
| GET | `/v5/projects/copilots/opportunity/:id/applications` | `platform-ui` | Optional `sort` | none | For admin/PM: full applications (`id,userId,status,notes,existingMembership,...`); for non-admin: reduced fields (`userId,status,createdAt`) |
| POST | `/v5/projects/copilots/opportunity/:id/assign` | `platform-ui` | none | `{applicationId: string}` | `{id: applicationId}` and side effects (member/requests/opportunity state transitions) |
| DELETE | `/v5/projects/copilots/opportunity/:id/cancel` | `platform-ui` | none | none | `{id: opportunityId}` and cascade cancellation side effects |
| GET | `/v5/projects/metadata/projectTypes` | `work-manager` | none | none | `ProjectType[]` (`key`, `displayName`, UI metadata fields) |

## P1 Endpoints (Active Routes, No In-Repo Caller Found)

| Method | Path | Calling services | Query params supported | Request body supported | Response shape |
|---|---|---|---|---|---|
| GET | `/v5/projects/:projectId/members` | **unused** | `role`, `fields` | none | Member array (optionally enriched with handle/email/user details) |
| GET | `/v5/projects/:projectId/members/:id` | **unused** | `fields` | none | Single member object |
| GET | `/v5/projects/:projectId/invites/:inviteId` | **unused** | `fields` | none | Single invite object |
| GET | `/v5/projects/:projectId/attachments` | **unused** | none | none | Attachment array (read-access filtered) |
| GET | `/v5/projects/:projectId/phases/:phaseId/products` | **unused** | none | none | Phase product array |
| GET | `/v5/projects/:projectId/phases/:phaseId/products/:productId` | **unused** | none | none | Single phase product |
| GET | `/v5/projects/:projectId/permissions` | **unused** | none | none | JWT: policy map `{ [policyName]: true }` for allowed work-management actions. In `/v6`, M2M/admin/project-manager/project-copilot callers receive a per-member permission matrix with memberships, project permissions, and template policies |
| DELETE | `/v5/projects/:projectId` | **unused** | none | none | `204` |
| GET | `/v5/projects/:projectId/phases/:phaseId` | **unused** | none | none | Phase object (includes members/approvals where present) |
| POST | `/v5/projects/:projectId/phases` | **unused** | none | `{name,status,description?,requirements?,startDate?,endDate?,duration?,budget?,spentBudget?,progress?,details?,order?,productTemplateId?,members?}` | Created phase |
| PATCH | `/v5/projects/:projectId/phases/:phaseId` | **unused** | none | Partial phase updates (same fields as create minus template link) | Updated phase |
| DELETE | `/v5/projects/:projectId/phases/:phaseId` | **unused** | none | none | `204` |
| PATCH | `/v5/projects/:projectId/phases/:phaseId/products/:productId` | **unused** | none | `{name?,type?,templateId?,directProjectId?,billingAccountId?,estimatedPrice?,actualPrice?,details?}` | Updated phase-product |

## P2 Metadata Endpoints (Mostly Unused in Current Repo)

| Method | Path | Calling services | Query params (supported/observed) | Request body schema (brief) | Response shape |
|---|---|---|---|---|---|
| GET | `/v5/projects/metadata` | **unused** | `includeAllReferred?` | none | Aggregate metadata object: `projectTemplates`, `productTemplates`, `forms`, `planConfigs`, `priceConfigs`, `projectTypes`, `productCategories`, `milestoneTemplates`, `buildingBlocks` |
| GET | `/v5/projects/metadata/projectTypes/:key` | **unused** | none | none | Single project type by `key` |
| POST | `/v5/projects/metadata/projectTypes` | **unused** | none | `{key,displayName,icon,question,info,aliases,metadata,disabled?,hidden?}` | Created project type |
| PATCH | `/v5/projects/metadata/projectTypes/:key` | **unused** | none | Partial of project type fields | Updated project type |
| DELETE | `/v5/projects/metadata/projectTypes/:key` | **unused** | none | none | `204` |
| GET | `/v5/projects/metadata/projectTemplates` | **unused** | none | none | Project template array (`disabled=false`) |
| GET | `/v5/projects/metadata/projectTemplates/:templateId` | **unused** | none | none | Single project template |
| POST | `/v5/projects/metadata/projectTemplates` | **unused** | none | `{name,key,category,subCategory?,metadata?,icon,question,info,aliases,scope/form,phases/planConfig,priceConfig?,disabled?,hidden?}` (`scope` xor `form`; `phases` xor `planConfig`) | Created template |
| PATCH | `/v5/projects/metadata/projectTemplates/:templateId` | **unused** | none | Partial template fields; same xor/nand constraints as create | Updated template |
| DELETE | `/v5/projects/metadata/projectTemplates/:templateId` | **unused** | none | none | `204` |
| GET | `/v5/projects/metadata/productTemplates` | **unused** | `productKey?` | none | Product template array |
| GET | `/v5/projects/metadata/orgConfig` | **unused** | `orgId` (required), `configName?` | none | Organization config array |
| GET | `/v5/projects/metadata/productCategories` | **unused** | none | none | Product category array |
| GET | `/v5/projects/metadata/workManagementPermission` | **unused** | `filter` (required; must include `projectTemplateId`) | none | Work-management permission rows (`/v6` additionally supports single lookup via `id` query) |

## Deprecated / Excluded from v6 Migration

| Method | Path pattern | Status | Rationale |
|---|---|---|---|
| Various | `/v5/projects/admin/es/*` | Deprecated | ES admin/maintenance endpoints not part of runtime consumer flows |
| POST/PATCH | `/v5/projects/:projectId/scopeChangeRequests*` | Deprecated/unused | No in-repo caller found |
| GET | `/v5/projects/:projectId/estimations/:estimationId/items` | Deprecated/unused | No in-repo caller found |
| GET | `/v5/projects/reports/*` | Deprecated/unused | No in-repo caller found |
| Various | `/v5/customer-payments/*` | Deprecated/unused | No in-repo caller found |
| Various | `/v5/projects/:projectId/phases/:phaseId/members*` | Deprecated/unused | No in-repo caller found |
| Various | `/v5/projects/:projectId/phases/:phaseId/approvals*` | Deprecated/unused | No in-repo caller found |
| Various | `/v5/projects/:projectId/workstreams/*` | Deferred/unused | No in-repo caller found in migration scope |
| Various | `/v5/projects/:projectId/settings*` | Deferred/unused | No in-repo caller found in migration scope |
| Various | `/v5/timelines*` | Not migrated | No active callers found in `work-manager`, `platform-ui`, `engagements-api-v6`, `challenge-api-v6`, or `community-app`; migration intentionally skipped per usage-based scope. |
| Various | `/v5/timelines/:timelineId/milestones*` | Not migrated | No active callers found in consumer scan; milestone CRUD/status-history flows intentionally skipped until usage appears. |

## Timeline and Milestone Migration Decision

- Timeline and Milestone CRUD endpoints were intentionally **not migrated** to `/v6` because no active usage was found in the consumer scan.
- This keeps migration aligned with the objective to port only actively used API calls.
- MilestoneTemplate metadata endpoints remain available in `src/api/metadata/milestone-template/` for admin metadata management.
- If timeline/milestone usage appears later, implementation guidance is documented in `docs/timeline-milestone-migration.md`.

## Authentication Notes

- Public routes in legacy service:
  - `GET /v5/projects/copilots/opportunities`
  - `GET /v5/projects/copilot/opportunity/:id`
- Other `/v5/projects*` routes require JWT or M2M token according to route-level permission checks.

## Sequence Diagram (`/v5`)

```mermaid
sequenceDiagram
    participant EA as engagements-api-v6
    participant WM as work-manager
    participant PUI as platform-ui
    participant CA as challenge-api-v6
    participant COMM as community-app
    participant PS as project-service (/v5)

    Note over EA,PS: Project validation + user extraction
    EA->>PS: GET /v5/projects/:projectId
    PS-->>EA: {project, members[], invites[]}

    Note over WM,PS: Project + billing flows
    WM->>PS: GET /v5/projects?sort=lastActivityAt desc&perPage=...
    PS-->>WM: [projects] + pagination headers
    WM->>PS: GET /v5/projects/:projectId/billingAccount
    PS-->>WM: {tcBillingAccountId, startDate, endDate, active}

    Note over WM,PS: Membership / invite / attachment
    WM->>PS: POST /v5/projects/:projectId/members
    WM->>PS: PATCH /v5/projects/:projectId/invites/:inviteId
    WM->>PS: GET /v5/projects/:projectId/attachments/:id

    Note over PUI,PS: Copilot request lifecycle
    PUI->>PS: GET /v5/projects/copilots/requests?page=...&pageSize=...&sort=...
    PUI->>PS: GET /v5/projects/copilots/requests/:copilotRequestId
    PUI->>PS: POST /v5/projects/:projectId/copilots/requests
    PUI->>PS: POST /v5/projects/:projectId/copilots/requests/:copilotRequestId/approve

    Note over PUI,COMM,PS: Opportunity lifecycle
    COMM->>PS: GET /v5/projects/copilots/opportunities?page=...&pageSize=...&sort=...&noGrouping=true
    PUI->>PS: GET /v5/projects/copilot/opportunity/:id
    PUI->>PS: POST /v5/projects/copilots/opportunity/:id/apply
    PUI->>PS: POST /v5/projects/copilots/opportunity/:id/assign

    Note over CA,PS: Challenge API dependency
    CA->>PS: GET /v5/projects/:projectId
    CA->>PS: GET /v5/projects/:projectId/billingAccount
    PS-->>CA: {project context, billing defaults}
```
