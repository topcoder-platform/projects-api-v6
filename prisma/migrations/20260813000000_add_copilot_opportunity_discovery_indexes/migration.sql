-- Support status/type ordering and cursor-stable page selection for the
-- opportunities experience without scanning the full opportunity table.
CREATE INDEX "copilot_opportunities_status_createdAt_id_idx"
ON "copilot_opportunities"("status", "createdAt", "id");

CREATE INDEX "copilot_opportunities_type_createdAt_id_idx"
ON "copilot_opportunities"("type", "createdAt", "id");

-- Support `applied`, `myApplications`, and `applicationStatus` existence
-- predicates for the authenticated user.
CREATE INDEX "copilot_applications_userId_opportunityId_deletedAt_status_idx"
ON "copilot_applications"("userId", "opportunityId", "deletedAt", "status");

-- `startDate` remains inside the v5-compatible request JSON envelope. This
-- expression index lets PostgreSQL filter/sort its canonical ISO value without
-- first materializing every request row.
CREATE INDEX "copilot_requests_startDate_idx"
ON "copilot_requests"((data ->> 'startDate'));
