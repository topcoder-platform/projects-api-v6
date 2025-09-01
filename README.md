
# TopCoder Projects API

## Configuration

Please check `.env.sample` to see configuration values and details.

Before running application, you should run:
```bash
cp .env.sample .env
```

You can edit values in `.env` to make it work.


## Database Setup

Please install Postgresql or start with docker like:
```bash
docker run -d --name projectdb -p 5432:5432 \
  -e POSTGRES_USER=johndoe -e POSTGRES_DB=projectdb \
  -e POSTGRES_PASSWORD=mypassword \
  postgres:16
```

Then you need to set environment variables for db. Please use:
```bash
export DB_SCHEMA="projects"
export DATABASE_URL="postgresql://johndoe:mypassword@localhost:5432/projectdb?schema=$DB_SCHEMA"
```


## Scripts

To help you setup db and test this API, there are some scripts:
```bash
# Make sure run this command first
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

Please make sure you have setup database and environment variables correctly.

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

We use `Postman` to test all apis.
Please import `doc/tc-projects-api.postman_collection.json`, `Local Dev Environment.postman_environment.json`

Then generate token
`pnpm exec ts-node mock/jwt.ts`

Then set `Admin Token` to `accessToken` in Postman environment
Then set `User Token` to `accessTokenUser` in Postman environment

Then you can test all postman apis.

I also provide a demo video here: https://youtu.be/vcoiKmbasOI

## Swagger

After starting application, swagger docs will be hosted on `http://localhost:3000/api-docs`

