-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "projects";

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'in_review', 'reviewed', 'active', 'completed', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'refused', 'requested', 'request_rejected', 'request_approved', 'canceled');

-- CreateEnum
CREATE TYPE "WorkStreamStatus" AS ENUM ('draft', 'reviewed', 'active', 'completed', 'paused');

-- CreateEnum
CREATE TYPE "CopilotRequestStatus" AS ENUM ('new', 'approved', 'rejected', 'seeking', 'canceled', 'fulfilled');

-- CreateEnum
CREATE TYPE "CopilotApplicationStatus" AS ENUM ('pending', 'invited', 'accepted', 'canceled');

-- CreateEnum
CREATE TYPE "CopilotOpportunityStatus" AS ENUM ('active', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "CopilotOpportunityType" AS ENUM ('dev', 'qa', 'design', 'ai', 'datascience');

-- CreateEnum
CREATE TYPE "ScopeChangeRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'activated', 'canceled');

-- CreateEnum
CREATE TYPE "CustomerPaymentStatus" AS ENUM ('canceled', 'processing', 'requires_action', 'requires_capture', 'requires_confirmation', 'requires_payment_method', 'succeeded', 'refunded', 'refund_failed', 'refund_pending');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('manager', 'observer', 'customer', 'copilot', 'account_manager', 'program_manager', 'account_executive', 'solution_architect', 'project_manager');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('file', 'link');

-- CreateEnum
CREATE TYPE "EstimationType" AS ENUM ('fee', 'community', 'topcoder_service');

-- CreateEnum
CREATE TYPE "ValueType" AS ENUM ('int', 'double', 'string', 'percentage');

-- CreateEnum
CREATE TYPE "TimelineReference" AS ENUM ('project', 'phase', 'product', 'work');

-- CreateEnum
CREATE TYPE "PhaseApprovalDecision" AS ENUM ('approve', 'reject');

-- CreateEnum
CREATE TYPE "CustomerPaymentCurrency" AS ENUM ('USD', 'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JMD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KRW', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRO', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SEK', 'SGD', 'SHP', 'SLL', 'SOS', 'SRD', 'STD', 'SZL', 'THB', 'TJS', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'UYU', 'UZS', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW');

-- CreateTable
CREATE TABLE "projects" (
    "id" BIGSERIAL NOT NULL,
    "directProjectId" BIGINT,
    "billingAccountId" BIGINT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "external" JSONB,
    "bookmarks" JSONB,
    "utm" JSONB,
    "estimatedPrice" DECIMAL(10,2),
    "actualPrice" DECIMAL(10,2),
    "terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "details" JSONB,
    "challengeEligibility" JSONB,
    "cancelReason" TEXT,
    "templateId" BIGINT,
    "version" VARCHAR(3) NOT NULL DEFAULT 'v3',
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "lastActivityUserId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_member_invites" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "userId" BIGINT,
    "email" TEXT,
    "applicationId" BIGINT,
    "role" "ProjectMemberRole" NOT NULL,
    "status" "InviteStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,
    "deletedBy" BIGINT,

    CONSTRAINT "project_member_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_phases" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "requirements" TEXT,
    "status" "ProjectStatus",
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "duration" INTEGER,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spentBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "details" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_products" (
    "id" BIGSERIAL NOT NULL,
    "phaseId" BIGINT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "directProjectId" BIGINT,
    "billingAccountId" BIGINT,
    "templateId" BIGINT NOT NULL DEFAULT 0,
    "name" TEXT,
    "type" TEXT,
    "estimatedPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "details" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "phase_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_phase_member" (
    "id" BIGSERIAL NOT NULL,
    "phaseId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_phase_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_phase_approval" (
    "id" BIGSERIAL NOT NULL,
    "phaseId" BIGINT NOT NULL,
    "decision" "PhaseApprovalDecision" NOT NULL,
    "comment" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_phase_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_attachments" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "title" TEXT,
    "type" "AttachmentType" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "size" INTEGER,
    "category" TEXT,
    "description" TEXT,
    "path" VARCHAR(2048) NOT NULL,
    "contentType" TEXT,
    "allowedUsers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timelines" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reference" "TimelineReference" NOT NULL,
    "referenceId" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" BIGSERIAL NOT NULL,
    "timelineId" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "duration" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL,
    "type" VARCHAR(45) NOT NULL,
    "details" JSONB,
    "order" INTEGER NOT NULL,
    "plannedText" VARCHAR(512),
    "activeText" VARCHAR(512),
    "completedText" VARCHAR(512),
    "blockedText" VARCHAR(512),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" BIGSERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "referenceId" BIGINT NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "comment" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_templates" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "key" VARCHAR(45) NOT NULL,
    "category" VARCHAR(45) NOT NULL,
    "subCategory" VARCHAR(45),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "icon" VARCHAR(255) NOT NULL,
    "question" VARCHAR(255) NOT NULL,
    "info" VARCHAR(1024) NOT NULL,
    "aliases" JSONB NOT NULL,
    "scope" JSONB,
    "phases" JSONB,
    "form" JSONB,
    "planConfig" JSONB,
    "priceConfig" JSONB,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_templates" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "productKey" VARCHAR(45) NOT NULL,
    "category" VARCHAR(45) NOT NULL,
    "subCategory" VARCHAR(45) NOT NULL,
    "icon" VARCHAR(255) NOT NULL,
    "brief" VARCHAR(45) NOT NULL,
    "details" VARCHAR(255) NOT NULL,
    "aliases" JSONB NOT NULL,
    "template" JSONB,
    "form" JSONB,
    "deletedAt" TIMESTAMP(3),
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "isAddOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "product_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_templates" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "duration" INTEGER NOT NULL,
    "type" VARCHAR(45) NOT NULL,
    "order" INTEGER NOT NULL,
    "plannedText" VARCHAR(512) NOT NULL,
    "activeText" VARCHAR(512) NOT NULL,
    "completedText" VARCHAR(512) NOT NULL,
    "blockedText" VARCHAR(512) NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "reference" VARCHAR(45) NOT NULL,
    "referenceId" BIGINT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "milestone_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_types" (
    "key" VARCHAR(45) NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(255) NOT NULL,
    "question" VARCHAR(255) NOT NULL,
    "info" VARCHAR(1024) NOT NULL,
    "aliases" JSONB NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_types_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "key" VARCHAR(45) NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(255) NOT NULL,
    "question" VARCHAR(255) NOT NULL,
    "info" VARCHAR(1024) NOT NULL,
    "aliases" JSONB NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "org_config" (
    "id" BIGSERIAL NOT NULL,
    "orgId" VARCHAR(45) NOT NULL,
    "configName" VARCHAR(45) NOT NULL,
    "configValue" VARCHAR(512),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "org_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(45) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 1,
    "revision" BIGINT NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_config" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(45) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 1,
    "revision" BIGINT NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "plan_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_config" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(45) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 1,
    "revision" BIGINT NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "price_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_streams" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(45) NOT NULL,
    "status" "WorkStreamStatus" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "work_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_work_streams" (
    "workStreamId" BIGINT NOT NULL,
    "phaseId" BIGINT NOT NULL,

    CONSTRAINT "phase_work_streams_pkey" PRIMARY KEY ("workStreamId","phaseId")
);

-- CreateTable
CREATE TABLE "work_management_permissions" (
    "id" BIGSERIAL NOT NULL,
    "policy" VARCHAR(255) NOT NULL,
    "permission" JSONB NOT NULL,
    "projectTemplateId" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "work_management_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_requests" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT,
    "status" "CopilotRequestStatus" NOT NULL DEFAULT 'new',
    "data" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "copilot_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_opportunities" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT,
    "copilotRequestId" BIGINT,
    "status" "CopilotOpportunityStatus" NOT NULL DEFAULT 'active',
    "type" "CopilotOpportunityType" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "copilot_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_applications" (
    "id" BIGSERIAL NOT NULL,
    "opportunityId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "notes" TEXT,
    "status" "CopilotApplicationStatus" NOT NULL DEFAULT 'pending',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "copilot_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_settings" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255),
    "valueType" "ValueType",
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "readPermission" JSONB NOT NULL DEFAULT '{}',
    "writePermission" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_estimations" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "buildingBlockKey" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER,
    "minTime" INTEGER NOT NULL,
    "maxTime" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_estimations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_estimation_items" (
    "id" BIGSERIAL NOT NULL,
    "projectEstimationId" BIGINT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "type" "EstimationType" NOT NULL,
    "markupUsedReference" TEXT NOT NULL,
    "markupUsedReferenceId" BIGINT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_estimation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_blocks" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "privateConfig" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "building_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_change_requests" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "oldScope" JSONB NOT NULL,
    "newScope" JSONB NOT NULL,
    "status" "ScopeChangeRequestStatus" NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "scope_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_history" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "project_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payments" (
    "id" BIGSERIAL NOT NULL,
    "reference" VARCHAR(45),
    "referenceId" VARCHAR(255),
    "amount" INTEGER NOT NULL,
    "currency" "CustomerPaymentCurrency" NOT NULL,
    "paymentIntentId" VARCHAR(255) NOT NULL,
    "clientSecret" VARCHAR(255),
    "status" "CustomerPaymentStatus" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT NOT NULL,

    CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");

-- CreateIndex
CREATE INDEX "projects_name_idx" ON "projects"("name");

-- CreateIndex
CREATE INDEX "projects_type_idx" ON "projects"("type");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_directProjectId_idx" ON "projects"("directProjectId");

-- CreateIndex
CREATE INDEX "project_members_deletedAt_idx" ON "project_members"("deletedAt");

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE INDEX "project_members_role_idx" ON "project_members"("role");

-- CreateIndex
CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");

-- CreateIndex
CREATE INDEX "project_member_invites_projectId_idx" ON "project_member_invites"("projectId");

-- CreateIndex
CREATE INDEX "project_member_invites_status_idx" ON "project_member_invites"("status");

-- CreateIndex
CREATE INDEX "project_member_invites_deletedAt_idx" ON "project_member_invites"("deletedAt");

-- CreateIndex
CREATE INDEX "project_phases_projectId_idx" ON "project_phases"("projectId");

-- CreateIndex
CREATE INDEX "phase_products_phaseId_idx" ON "phase_products"("phaseId");

-- CreateIndex
CREATE INDEX "phase_products_projectId_idx" ON "phase_products"("projectId");

-- CreateIndex
CREATE INDEX "project_phase_member_phaseId_idx" ON "project_phase_member"("phaseId");

-- CreateIndex
CREATE UNIQUE INDEX "project_phase_member_phaseId_userId_key" ON "project_phase_member"("phaseId", "userId");

-- CreateIndex
CREATE INDEX "project_phase_approval_phaseId_idx" ON "project_phase_approval"("phaseId");

-- CreateIndex
CREATE INDEX "project_attachments_projectId_idx" ON "project_attachments"("projectId");

-- CreateIndex
CREATE INDEX "timelines_reference_referenceId_idx" ON "timelines"("reference", "referenceId");

-- CreateIndex
CREATE INDEX "milestones_timelineId_idx" ON "milestones"("timelineId");

-- CreateIndex
CREATE INDEX "milestones_status_idx" ON "milestones"("status");

-- CreateIndex
CREATE INDEX "status_history_reference_referenceId_idx" ON "status_history"("reference", "referenceId");

-- CreateIndex
CREATE INDEX "project_templates_key_idx" ON "project_templates"("key");

-- CreateIndex
CREATE INDEX "project_templates_category_idx" ON "project_templates"("category");

-- CreateIndex
CREATE INDEX "product_templates_productKey_idx" ON "product_templates"("productKey");

-- CreateIndex
CREATE INDEX "product_templates_category_idx" ON "product_templates"("category");

-- CreateIndex
CREATE INDEX "milestone_templates_reference_referenceId_idx" ON "milestone_templates"("reference", "referenceId");

-- CreateIndex
CREATE INDEX "form_key_idx" ON "form"("key");

-- CreateIndex
CREATE UNIQUE INDEX "form_key_version_revision_key" ON "form"("key", "version", "revision");

-- CreateIndex
CREATE INDEX "plan_config_key_idx" ON "plan_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "plan_config_key_version_revision_key" ON "plan_config"("key", "version", "revision");

-- CreateIndex
CREATE INDEX "price_config_key_idx" ON "price_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "price_config_key_version_revision_key" ON "price_config"("key", "version", "revision");

-- CreateIndex
CREATE INDEX "work_streams_projectId_idx" ON "work_streams"("projectId");

-- CreateIndex
CREATE INDEX "work_streams_status_idx" ON "work_streams"("status");

-- CreateIndex
CREATE INDEX "work_management_permissions_projectTemplateId_idx" ON "work_management_permissions"("projectTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "work_management_permissions_policy_projectTemplateId_key" ON "work_management_permissions"("policy", "projectTemplateId");

-- CreateIndex
CREATE INDEX "copilot_requests_projectId_idx" ON "copilot_requests"("projectId");

-- CreateIndex
CREATE INDEX "copilot_requests_status_idx" ON "copilot_requests"("status");

-- CreateIndex
CREATE INDEX "copilot_opportunities_projectId_idx" ON "copilot_opportunities"("projectId");

-- CreateIndex
CREATE INDEX "copilot_opportunities_copilotRequestId_idx" ON "copilot_opportunities"("copilotRequestId");

-- CreateIndex
CREATE INDEX "copilot_opportunities_status_idx" ON "copilot_opportunities"("status");

-- CreateIndex
CREATE INDEX "copilot_applications_opportunityId_idx" ON "copilot_applications"("opportunityId");

-- CreateIndex
CREATE INDEX "copilot_applications_userId_idx" ON "copilot_applications"("userId");

-- CreateIndex
CREATE INDEX "copilot_applications_status_idx" ON "copilot_applications"("status");

-- CreateIndex
CREATE INDEX "project_settings_projectId_idx" ON "project_settings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_settings_key_projectId_key" ON "project_settings"("key", "projectId");

-- CreateIndex
CREATE INDEX "project_estimations_projectId_idx" ON "project_estimations"("projectId");

-- CreateIndex
CREATE INDEX "project_estimation_items_projectEstimationId_idx" ON "project_estimation_items"("projectEstimationId");

-- CreateIndex
CREATE UNIQUE INDEX "building_blocks_key_key" ON "building_blocks"("key");

-- CreateIndex
CREATE INDEX "scope_change_requests_projectId_idx" ON "scope_change_requests"("projectId");

-- CreateIndex
CREATE INDEX "scope_change_requests_status_idx" ON "scope_change_requests"("status");

-- CreateIndex
CREATE INDEX "project_history_projectId_idx" ON "project_history"("projectId");

-- CreateIndex
CREATE INDEX "customer_payments_paymentIntentId_idx" ON "customer_payments"("paymentIntentId");

-- CreateIndex
CREATE INDEX "customer_payments_status_idx" ON "customer_payments"("status");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member_invites" ADD CONSTRAINT "project_member_invites_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member_invites" ADD CONSTRAINT "project_member_invites_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "copilot_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_products" ADD CONSTRAINT "phase_products_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "project_phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_phase_member" ADD CONSTRAINT "project_phase_member_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "project_phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_phase_approval" ADD CONSTRAINT "project_phase_approval_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "project_phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_streams" ADD CONSTRAINT "work_streams_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_work_streams" ADD CONSTRAINT "phase_work_streams_workStreamId_fkey" FOREIGN KEY ("workStreamId") REFERENCES "work_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_work_streams" ADD CONSTRAINT "phase_work_streams_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "project_phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_management_permissions" ADD CONSTRAINT "work_management_permissions_projectTemplateId_fkey" FOREIGN KEY ("projectTemplateId") REFERENCES "project_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_requests" ADD CONSTRAINT "copilot_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_opportunities" ADD CONSTRAINT "copilot_opportunities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_opportunities" ADD CONSTRAINT "copilot_opportunities_copilotRequestId_fkey" FOREIGN KEY ("copilotRequestId") REFERENCES "copilot_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_applications" ADD CONSTRAINT "copilot_applications_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "copilot_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_estimations" ADD CONSTRAINT "project_estimations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_estimation_items" ADD CONSTRAINT "project_estimation_items_projectEstimationId_fkey" FOREIGN KEY ("projectEstimationId") REFERENCES "project_estimations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_history" ADD CONSTRAINT "project_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

