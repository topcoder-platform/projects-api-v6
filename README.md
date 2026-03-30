# TopCoder Projects API

## Configuration

Please check `.env.example` to see configuration values and details.

Before running the application, copy the example file:

```bash
cp .env.example .env
```

Then edit `.env` so it matches your local setup.

If you want project billing-account lookups to resolve markup from the
billing-accounts service before falling back to Salesforce, set
`BILLING_ACCOUNTS_API_URL` in `.env`.

## Database Setup

Please install PostgreSQL or start it with Docker like this:

```bash
docker run -d --name projectdb -p 5432:5432 \
  -e POSTGRES_USER=johndoe -e POSTGRES_DB=projectdb \
  -e POSTGRES_PASSWORD=mypassword \
  postgres:16
```

Then set the database environment variables:

```bash
export DB_SCHEMA="projects"
export DATABASE_URL="postgresql://johndoe:mypassword@localhost:5432/projectdb?schema=$DB_SCHEMA"
```

## Scripts

To help you set up the database and test this API, there are some scripts:

```bash
# Make sure you run this command first
pnpm install

# init db
pnpm run init-db

# reset db
pnpm run reset-db

# generate seed data
pnpm run seed-data

# Generate jwt
pnpm exec ts-node mock/jwt.ts

# Run mock api
node mock/mock-api.js
```

## Local Deployment

Please make sure you have set up the database and environment variables
correctly.

After that, you can run:

```bash
pnpm install

# init db first
pnpm run init-db

# generate seed data
pnpm run seed-data

# Run mock api
node mock/mock-api.js

# Start application
pnpm run start
```

## Verify

We use `Postman` to test all APIs.
Please import `doc/tc-projects-api.postman_collection.json` and
`doc/Local Dev Environment.postman_environment.json`.

Then generate tokens:

```bash
pnpm exec ts-node mock/jwt.ts
```

Then set `Admin Token` to `accessToken` in the Postman environment and
`User Token` to `accessTokenUser`.

Then you can test all Postman APIs.

I also provide a demo video here: https://youtu.be/vcoiKmbasOI

## Swagger

After starting the application, Swagger docs will be hosted at
`http://localhost:3000/v6/projects/api-docs`.
