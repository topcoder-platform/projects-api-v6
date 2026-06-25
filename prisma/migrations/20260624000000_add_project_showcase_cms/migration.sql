-- Create enum for project showcase post status
CREATE TYPE projects."ProjectShowcasePostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Create project showcase posts table
CREATE TABLE projects."project_showcase_posts" (
  "id" BIGSERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "content" TEXT NOT NULL,
  "status" projects."ProjectShowcasePostStatus" NOT NULL DEFAULT 'DRAFT',
  "projectId" BIGINT NOT NULL,
  "challengeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdById" INTEGER NOT NULL,
  "updatedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Create taxonomy tables
CREATE TABLE projects."project_post_industries" (
  "id" BIGSERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE projects."project_post_categories" (
  "id" BIGSERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE
);

-- Create join tables for many-to-many relationships
CREATE TABLE projects."project_showcase_post_industries" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectShowcasePostId" BIGINT NOT NULL,
  "industryId" BIGINT NOT NULL,
  CONSTRAINT "project_showcase_post_industries_project_showcase_post_fkey"
    FOREIGN KEY ("projectShowcasePostId") REFERENCES projects."project_showcase_posts"("id") ON DELETE CASCADE,
  CONSTRAINT "project_showcase_post_industries_industry_fkey"
    FOREIGN KEY ("industryId") REFERENCES projects."project_post_industries"("id") ON DELETE CASCADE,
  CONSTRAINT "project_showcase_post_industries_unique"
    UNIQUE ("projectShowcasePostId", "industryId")
);

CREATE TABLE projects."project_showcase_post_categories" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectShowcasePostId" BIGINT NOT NULL,
  "categoryId" BIGINT NOT NULL,
  CONSTRAINT "project_showcase_post_categories_project_showcase_post_fkey"
    FOREIGN KEY ("projectShowcasePostId") REFERENCES projects."project_showcase_posts"("id") ON DELETE CASCADE,
  CONSTRAINT "project_showcase_post_categories_category_fkey"
    FOREIGN KEY ("categoryId") REFERENCES projects."project_post_categories"("id") ON DELETE CASCADE,
  CONSTRAINT "project_showcase_post_categories_unique"
    UNIQUE ("projectShowcasePostId", "categoryId")
);

-- Indexes for query performance
CREATE INDEX "project_showcase_posts_status_idx" ON projects."project_showcase_posts"("status");
CREATE INDEX "project_showcase_posts_project_id_idx" ON projects."project_showcase_posts"("projectId");
CREATE INDEX "project_showcase_post_industries_project_showcase_post_id_idx" ON projects."project_showcase_post_industries"("projectShowcasePostId");
CREATE INDEX "project_showcase_post_industries_industry_id_idx" ON projects."project_showcase_post_industries"("industryId");
CREATE INDEX "project_showcase_post_categories_project_showcase_post_id_idx" ON projects."project_showcase_post_categories"("projectShowcasePostId");
CREATE INDEX "project_showcase_post_categories_category_id_idx" ON projects."project_showcase_post_categories"("categoryId");
