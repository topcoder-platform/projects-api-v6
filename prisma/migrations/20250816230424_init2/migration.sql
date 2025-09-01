/*
  Warnings:

  - The `priceFormula` column on the `ProjectEstimationMetadata` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `email` to the `ProjectMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `handle` to the `ProjectMember` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WorkStreamStatus" AS ENUM ('draft', 'reviewed', 'active', 'completed', 'paused');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectUrl" TEXT;

-- AlterTable
ALTER TABLE "ProjectDetailAppDefinition" ADD COLUMN     "addons" JSONB,
ADD COLUMN     "securityRequirements" JSONB,
ADD COLUMN     "userRequirements" JSONB;

-- AlterTable
ALTER TABLE "ProjectEstimationMetadata" DROP COLUMN "priceFormula",
ADD COLUMN     "priceFormula" INTEGER;

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "handle" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT;

-- CreateTable
CREATE TABLE "ProjectDetailTechstack" (
    "id" BIGSERIAL NOT NULL,
    "languages" TEXT[],
    "frameworks" TEXT[],
    "database" TEXT,
    "hosting" TEXT,
    "others" TEXT,
    "projectDetailId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectDetailTechstack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDetailApiDefinition" (
    "id" BIGSERIAL NOT NULL,
    "addons" TEXT[],
    "deliverables" TEXT[],
    "deploymentTargets" TEXT[],
    "projectDetailId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectDetailApiDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhase" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "spentBudget" INTEGER,
    "requirements" TEXT,
    "description" TEXT,
    "duration" INTEGER,
    "progress" INTEGER,
    "details" JSONB,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "budget" INTEGER,
    "order" INTEGER,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhaseProduct" (
    "id" BIGSERIAL NOT NULL,
    "actualPrice" DECIMAL(65,30),
    "billingAccountId" BIGINT,
    "templateId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "estimatedPrice" DECIMAL(65,30),
    "name" TEXT NOT NULL,
    "details" JSONB,
    "directProjectId" BIGINT,
    "projectId" BIGINT NOT NULL,
    "phaseId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "ProjectPhaseProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhaseMember" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "phaseId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectPhaseMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTemplate" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "info" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "scope" JSONB,
    "phases" JSONB,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "planConfig" JSONB,
    "priceConfig" JSONB,
    "form" JSONB,
    "subCategory" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectHistory" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" BIGINT,

    CONSTRAINT "ProjectHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanConfig" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTemplate" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "icon" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "form" JSONB,
    "template" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "ProductTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkStream" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WorkStreamStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "WorkStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectType" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "info" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "disabled" BOOLEAN NOT NULL,
    "hidden" BOOLEAN NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT NOT NULL,
    "updatedBy" BIGINT,
    "deletedBy" BIGINT,

    CONSTRAINT "ProjectType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDetailTechstack_projectDetailId_key" ON "ProjectDetailTechstack"("projectDetailId");

-- CreateIndex
CREATE INDEX "ProjectDetailTechstack_projectDetailId_idx" ON "ProjectDetailTechstack"("projectDetailId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDetailApiDefinition_projectDetailId_key" ON "ProjectDetailApiDefinition"("projectDetailId");

-- CreateIndex
CREATE INDEX "ProjectDetailApiDefinition_projectDetailId_idx" ON "ProjectDetailApiDefinition"("projectDetailId");

-- CreateIndex
CREATE INDEX "ProjectPhase_projectId_idx" ON "ProjectPhase"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPhaseProduct_phaseId_idx" ON "ProjectPhaseProduct"("phaseId");

-- CreateIndex
CREATE INDEX "ProjectPhaseMember_phaseId_idx" ON "ProjectPhaseMember"("phaseId");

-- CreateIndex
CREATE INDEX "ProjectPhaseMember_userId_idx" ON "ProjectPhaseMember"("userId");

-- AddForeignKey
ALTER TABLE "ProjectDetailTechstack" ADD CONSTRAINT "ProjectDetailTechstack_projectDetailId_fkey" FOREIGN KEY ("projectDetailId") REFERENCES "ProjectDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDetailApiDefinition" ADD CONSTRAINT "ProjectDetailApiDefinition_projectDetailId_fkey" FOREIGN KEY ("projectDetailId") REFERENCES "ProjectDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhaseProduct" ADD CONSTRAINT "ProjectPhaseProduct_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhaseMember" ADD CONSTRAINT "ProjectPhaseMember_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
