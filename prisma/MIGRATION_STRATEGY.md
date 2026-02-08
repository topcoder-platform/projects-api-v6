# Prisma Migration Strategy

## Objective
Adopt Prisma Client for type-safe access to an existing tc-project-service database without introducing schema changes.

## Core Policy
- Treat the existing PostgreSQL schema as source of truth.
- Prisma is used for schema representation and client generation.
- Prisma Migrate is **not** the migration authority for this project.

## Recommended Workflow
1. Keep Sequelize migrations as the canonical migration mechanism.
2. Update `prisma/schema.prisma` to reflect the current DB shape.
3. Validate and regenerate client:
   - `npx prisma validate --schema prisma/schema.prisma`
   - `npx prisma generate --schema prisma/schema.prisma`
4. For local development synchronization (non-production), use `prisma db push` only when the target DB is disposable and schema drift is acceptable.

## What To Avoid
- Do not run `prisma migrate dev` or `prisma migrate deploy` against shared/staging/production environments for this service.
- Do not use Prisma-generated SQL migrations to replace existing Sequelize migration history.

## Handling Schema Drift
- If drift is detected:
  1. Apply required DB change through the existing Sequelize migration process.
  2. Re-introspect (`prisma db pull`) and update Prisma schema to match.
  3. Regenerate Prisma Client.
- If Prisma cannot fully express a DB feature (partial indexes, generic polymorphic references, etc.), document the gap in `SCHEMA_NOTES.md` and keep enforcement in DB/application logic.

## Relationship Between Sequelize and Prisma
- Sequelize migrations: authoritative for DDL and schema evolution.
- Prisma schema: typed mirror of the current database for query/client ergonomics.
- Prisma Client: runtime access layer generated from the mirrored schema.
