-- Add publishedAt, publishedBy, and alt to project showcase posts and media
ALTER TABLE projects."project_showcase_posts"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedBy" INTEGER;

ALTER TABLE projects."project_showcase_post_media"
  ADD COLUMN "alt" TEXT;
