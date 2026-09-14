# `@topcoder/projects-api-v6`

This package exports the Projects API v6 Prisma models, enums, query types, and
`PrismaClient`. It also provides a stable factory that configures the Prisma 7
PostgreSQL driver adapter for service-to-service database aggregation.

Install it from the repository subdirectory, consistent with other Topcoder v6
Prisma clients:

```json
{
  "dependencies": {
    "@topcoder/projects-api-v6": "github:topcoder-platform/projects-api-v6#<commit>&path:packages/projects-prisma-client"
  }
}
```

Create and own one client for the process:

```ts
import {
  CopilotOpportunityStatus,
  createProjectsPrismaClient,
} from '@topcoder/projects-api-v6';

const projects = createProjectsPrismaClient(process.env.PROJECTS_DB_URL!, {
  clientOptions: { log: ['warn', 'error'] },
  driverOptions: {
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    statement_timeout: 5000,
  },
});

const activeCount = await projects.copilotOpportunity.count({
  where: { status: CopilotOpportunityStatus.active, deletedAt: null },
});

await projects.$disconnect();
```

The optional `schema` setting overrides the connection string's `schema` query
parameter. `driverOptions` exposes bounded PostgreSQL pool/query settings while
the factory continues to own adapter construction. The returned client is
caller-owned and must be disconnected during application shutdown. The package
pins Prisma and `@prisma/adapter-pg` to 7.9.0.
