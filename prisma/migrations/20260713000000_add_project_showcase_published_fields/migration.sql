-- Add publishedAt and publishedBy to project showcase posts
ALTER TABLE projects."project_showcase_posts"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedBy" INTEGER;
