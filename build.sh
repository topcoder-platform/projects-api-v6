#!/bin/bash
set -eo pipefail
docker buildx build --no-cache=true --build-arg RESET_DB_ARG=false --build-arg SEED_DATA_ARG=${DEPLOYMENT_ENVIRONMENT:-dev} -t project-service-v6:latest .
