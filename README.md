# Topcoder Project API v6

Topcoder Project API v6 is a modern NestJS-based project service that serves as a drop-in replacement for `tc-project-service`.

## Technology Stack

- TypeScript
- NestJS
- Prisma
- PostgreSQL
- Swagger
- pnpm

## Key Differences from v5

- No Elasticsearch dependency
- Only actively-used endpoints are ported
- API endpoints use `/v6` prefix instead of `/v5`

## Setup

### Prerequisites

- Node.js `v22.13.1`
- pnpm
- PostgreSQL

### Installation

```bash
pnpm install
```

### Database Setup

1. Configure `DATABASE_URL` in your environment (see `.env.example`).
2. Run migrations:

```bash
npx prisma migrate dev
```

### Development

```bash
pnpm run start:dev
```

### Production

```bash
pnpm run build && pnpm run start:prod
```

## Testing

- Unit tests: `pnpm test`
- Coverage: `pnpm test:cov`
- E2E tests: `pnpm test:e2e`

## Linting

```bash
pnpm lint
```

## API Documentation

Swagger docs are available at:

- `http://localhost:3000/v6/projects/api-docs`

## Health Check

- `GET /v6/projects/health`

## Environment Variables

Use `.env.example` as the reference source.

## Deployment

Deployments are automated via CircleCI to AWS ECS Fargate.

## Downstream Usage

This API is used by the following services:

- `work-manager`
- `platform-ui`
- `engagements-api-v6`
- `challenge-api-v6`
- `community-app`
