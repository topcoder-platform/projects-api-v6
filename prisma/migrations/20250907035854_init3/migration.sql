-- CreateEnum
CREATE TYPE "CopilotRequestStatus" AS ENUM ('new', 'approved', 'rejected', 'seeking', 'canceled', 'fulfilled');

-- CreateEnum
CREATE TYPE "CopilotApplicationStatus" AS ENUM ('pending', 'invited', 'accepted', 'canceled');

-- CreateEnum
CREATE TYPE "CopilotOpportunityStatus" AS ENUM ('active', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "CopilotOpportunityType" AS ENUM ('dev', 'qa', 'design', 'ai', 'datascience');

-- CreateTable
CREATE TABLE "CopilotRequest" (
    "id" BIGSERIAL NOT NULL,
    "status" "CopilotRequestStatus" NOT NULL DEFAULT 'new',
    "data" JSONB NOT NULL,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "CopilotRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotApplication" (
    "id" BIGSERIAL NOT NULL,
    "notes" TEXT,
    "status" "CopilotApplicationStatus" NOT NULL DEFAULT 'pending',
    "userId" BIGINT NOT NULL,
    "opportunityId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "CopilotApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotOpportunity" (
    "id" BIGSERIAL NOT NULL,
    "status" "CopilotOpportunityStatus" NOT NULL DEFAULT 'active',
    "type" "CopilotOpportunityType" NOT NULL,
    "copilotRequestId" BIGINT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "CopilotOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotApplication_opportunityId_idx" ON "CopilotApplication"("opportunityId");

-- AddForeignKey
ALTER TABLE "CopilotRequest" ADD CONSTRAINT "CopilotRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotApplication" ADD CONSTRAINT "CopilotApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CopilotOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotOpportunity" ADD CONSTRAINT "CopilotOpportunity_copilotRequestId_fkey" FOREIGN KEY ("copilotRequestId") REFERENCES "CopilotRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotOpportunity" ADD CONSTRAINT "CopilotOpportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
