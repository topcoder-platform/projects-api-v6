#!/bin/bash
set -eo pipefail

export DATABASE_URL=$(echo -e ${DATABASE_URL})

# Set default schema to 'public' if not provided
if [ -z "$POSTGRES_SCHEMA" ]; then
    echo "POSTGRES_SCHEMA not set, defaulting to 'public'"
    export POSTGRES_SCHEMA="public"
else
    echo "Using PostgreSQL schema: $POSTGRES_SCHEMA"
fi

echo "Database - running migrations."
npx prisma migrate deploy

# Start the app
exec node dist/src/main
