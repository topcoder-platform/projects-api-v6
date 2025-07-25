
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

# Generate jwt
pnpm exec ts-node mock/jwt.ts
```

## Local Deployment

Please make sure you have setup database and environment variables correctly.

After that, you can run:
```bash
pnpm install

# Start application
pnpm start
```


## Swagger

After starting application, swagger docs will be hosted on `http://localhost:3000/api-docs`

