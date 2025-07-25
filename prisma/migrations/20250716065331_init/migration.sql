-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'in_review', 'reviewed', 'active', 'completed', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "ExternalType" AS ENUM ('github', 'jira', 'asana', 'other');

-- CreateEnum
CREATE TYPE "EligibilityRole" AS ENUM ('submitter', 'reviewer', 'copilot');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('file', 'link');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('manager', 'observer', 'customer', 'copilot', 'account_manager', 'program_manager', 'account_executive', 'solution_architect', 'project_manager');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'refused', 'requested', 'request_rejected', 'request_approved', 'canceled');

-- CreateTable
CREATE TABLE "Project" (
    "id" BIGSERIAL NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectFullText" TEXT,
    "billingAccountId" BIGINT,
    "directProjectId" BIGINT,
    "type" TEXT NOT NULL,
    "version" TEXT,
    "templateId" BIGINT,
    "estimatedPrice" DECIMAL(65,30),
    "actualPrice" DECIMAL(65,30),
    "cancelReason" TEXT,
    "terms" TEXT[],
    "groups" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" BIGINT,
    "lastActivityAt" TIMESTAMP(3),
    "lastActivityUserId" BIGINT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDetail" (
    "id" BIGSERIAL NOT NULL,
    "products" TEXT[],
    "intakePurpose" TEXT,
    "hideDiscussions" BOOLEAN,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDetailProjectData" (
    "id" BIGSERIAL NOT NULL,
    "customerProject" TEXT,
    "executionHub" TEXT,
    "groupCustomerName" TEXT,
    "projectCode" TEXT,
    "groupName" TEXT,
    "costCenter" TEXT,
    "wbsCode" TEXT,
    "onsiteEfforts" TEXT DEFAULT '0',
    "offshoreEfforts" TEXT DEFAULT '0',
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "partOfNg3" TEXT,
    "companyCode" TEXT,
    "approvedAmount" TEXT,
    "projectClassificationCode" TEXT,
    "invoiceType" TEXT,
    "sowNumber" TEXT,
    "sector" TEXT,
    "smu" TEXT,
    "subExecutionHub" TEXT,
    "initiatorEmail" TEXT,
    "projectDetailId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectDetailProjectData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDetailUtm" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT,
    "projectDetailId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectDetailUtm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDetailSetting" (
    "id" BIGSERIAL NOT NULL,
    "workstreams" BOOLEAN,
    "projectDetailId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectDetailSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDetailAppDefinition" (
    "id" BIGSERIAL NOT NULL,
    "budget" DECIMAL(65,30),
    "deliverables" TEXT[],
    "expectedOutcome" TEXT[],
    "designGoal" TEXT[],
    "needAdditionalScreens" TEXT,
    "targetDevices" TEXT[],
    "webBrowserBehaviour" TEXT,
    "webBrowsersSupported" TEXT[],
    "hasBrandGuidelines" TEXT,
    "needSpecificFonts" TEXT,
    "needSpecificColors" TEXT,
    "projectDetailId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectDetailAppDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUtm" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectUtm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExternal" (
    "id" BIGSERIAL NOT NULL,
    "extId" TEXT NOT NULL,
    "type" "ExternalType" NOT NULL,
    "data" TEXT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectExternal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeEligibility" (
    "id" BIGSERIAL NOT NULL,
    "role" "EligibilityRole" NOT NULL,
    "projectId" BIGINT NOT NULL,
    "users" BIGINT[],
    "groups" BIGINT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ChallengeEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEstimation" (
    "id" BIGSERIAL NOT NULL,
    "conditions" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "quantity" INTEGER,
    "minTime" INTEGER NOT NULL,
    "maxTime" INTEGER NOT NULL,
    "buildingBlockKey" TEXT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" BIGINT,

    CONSTRAINT "ProjectEstimation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEstimationMetadata" (
    "id" BIGSERIAL NOT NULL,
    "deliverable" TEXT,
    "priceFormula" TEXT,
    "projectEstimationId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" BIGINT,

    CONSTRAINT "ProjectEstimationMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBookmark" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAttachment" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "type" "AttachmentType" NOT NULL,
    "tags" TEXT[],
    "size" INTEGER,
    "category" TEXT,
    "description" TEXT,
    "path" TEXT NOT NULL,
    "contentType" TEXT,
    "allowedUsers" INTEGER[],
    "projectId" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "projectId" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMemberInvite" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT,
    "email" TEXT,
    "applicationId" BIGINT,
    "role" "ProjectMemberRole" NOT NULL,
    "status" "InviteStatus" NOT NULL,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "ProjectMemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRule" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT,
    "group" TEXT,
    "description" TEXT,
    "projectRoles" TEXT[],
    "topcoderRoles" TEXT[],
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "AccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkManagementPermission" (
    "id" BIGSERIAL NOT NULL,
    "policy" TEXT NOT NULL,
    "projectTemplateId" BIGINT NOT NULL,
    "permissionRuleId" BIGINT,
    "allowRuleId" BIGINT,
    "denyRuleId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "WorkManagementPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDetail_projectId_key" ON "ProjectDetail"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDetail_projectId_idx" ON "ProjectDetail"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDetailProjectData_projectDetailId_key" ON "ProjectDetailProjectData"("projectDetailId");

-- CreateIndex
CREATE INDEX "ProjectDetailProjectData_projectDetailId_idx" ON "ProjectDetailProjectData"("projectDetailId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDetailUtm_projectDetailId_key" ON "ProjectDetailUtm"("projectDetailId");

-- CreateIndex
CREATE INDEX "ProjectDetailUtm_projectDetailId_idx" ON "ProjectDetailUtm"("projectDetailId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDetailSetting_projectDetailId_key" ON "ProjectDetailSetting"("projectDetailId");

-- CreateIndex
CREATE INDEX "ProjectDetailSetting_projectDetailId_idx" ON "ProjectDetailSetting"("projectDetailId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDetailAppDefinition_projectDetailId_key" ON "ProjectDetailAppDefinition"("projectDetailId");

-- CreateIndex
CREATE INDEX "ProjectDetailAppDefinition_projectDetailId_idx" ON "ProjectDetailAppDefinition"("projectDetailId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUtm_projectId_key" ON "ProjectUtm"("projectId");

-- CreateIndex
CREATE INDEX "ProjectUtm_projectId_idx" ON "ProjectUtm"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectExternal_projectId_key" ON "ProjectExternal"("projectId");

-- CreateIndex
CREATE INDEX "ProjectExternal_projectId_idx" ON "ProjectExternal"("projectId");

-- CreateIndex
CREATE INDEX "ChallengeEligibility_projectId_idx" ON "ChallengeEligibility"("projectId");

-- CreateIndex
CREATE INDEX "ProjectEstimation_projectId_idx" ON "ProjectEstimation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEstimationMetadata_projectEstimationId_key" ON "ProjectEstimationMetadata"("projectEstimationId");

-- CreateIndex
CREATE INDEX "ProjectEstimationMetadata_projectEstimationId_idx" ON "ProjectEstimationMetadata"("projectEstimationId");

-- CreateIndex
CREATE INDEX "ProjectBookmark_projectId_idx" ON "ProjectBookmark"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAttachment_projectId_idx" ON "ProjectAttachment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "ProjectMemberInvite_projectId_idx" ON "ProjectMemberInvite"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMemberInvite_userId_idx" ON "ProjectMemberInvite"("userId");

-- CreateIndex
CREATE INDEX "WorkManagementPermission_projectTemplateId_idx" ON "WorkManagementPermission"("projectTemplateId");

-- AddForeignKey
ALTER TABLE "ProjectDetail" ADD CONSTRAINT "ProjectDetail_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDetailProjectData" ADD CONSTRAINT "ProjectDetailProjectData_projectDetailId_fkey" FOREIGN KEY ("projectDetailId") REFERENCES "ProjectDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDetailUtm" ADD CONSTRAINT "ProjectDetailUtm_projectDetailId_fkey" FOREIGN KEY ("projectDetailId") REFERENCES "ProjectDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDetailSetting" ADD CONSTRAINT "ProjectDetailSetting_projectDetailId_fkey" FOREIGN KEY ("projectDetailId") REFERENCES "ProjectDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDetailAppDefinition" ADD CONSTRAINT "ProjectDetailAppDefinition_projectDetailId_fkey" FOREIGN KEY ("projectDetailId") REFERENCES "ProjectDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUtm" ADD CONSTRAINT "ProjectUtm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExternal" ADD CONSTRAINT "ProjectExternal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEligibility" ADD CONSTRAINT "ChallengeEligibility_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstimation" ADD CONSTRAINT "ProjectEstimation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstimationMetadata" ADD CONSTRAINT "ProjectEstimationMetadata_projectEstimationId_fkey" FOREIGN KEY ("projectEstimationId") REFERENCES "ProjectEstimation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBookmark" ADD CONSTRAINT "ProjectBookmark_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMemberInvite" ADD CONSTRAINT "ProjectMemberInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkManagementPermission" ADD CONSTRAINT "WorkManagementPermission_permissionRuleId_fkey" FOREIGN KEY ("permissionRuleId") REFERENCES "AccessRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkManagementPermission" ADD CONSTRAINT "WorkManagementPermission_allowRuleId_fkey" FOREIGN KEY ("allowRuleId") REFERENCES "AccessRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkManagementPermission" ADD CONSTRAINT "WorkManagementPermission_denyRuleId_fkey" FOREIGN KEY ("denyRuleId") REFERENCES "AccessRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
