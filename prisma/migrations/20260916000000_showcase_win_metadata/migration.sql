-- Nullable content fields preserve existing posts; existing posts are not opted in.
ALTER TABLE "project_showcase_posts"
  ADD COLUMN "type" TEXT,
  ADD COLUMN "challenge" TEXT,
  ADD COLUMN "businessImpact" TEXT,
  ADD COLUMN "keyWin" VARCHAR(255),
  ADD COLUMN "currentStatus" TEXT,
  ADD COLUMN "owner" VARCHAR(255),
  ADD COLUMN "sendToWin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "project_showcase_posts_sendToWin_id_idx"
  ON "project_showcase_posts" ("sendToWin", "id");
