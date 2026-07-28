#!/bin/bash
set -eo pipefail

export DATABASE_URL=$(echo -e ${DATABASE_URL})

echo "Database - running migrations."
node node_modules/prisma/build/index.js migrate deploy

# Start the app
exec node dist/src/main
