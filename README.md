# Glim Node

TypeScript-first primitives for building Hono services on Bun, plus a CLI that scaffolds projects and runs Drizzle migrations.

It gives you a typed app or module instance with environment-backed clients for databases, cache, storage, notifications, and outbound HTTP.

## CLI

Install the CLI first:

```bash
bun add -g glim-node
```

Or run it without installing:

```bash
bunx glim-node create
```

### Create a project

```bash
gn create --name my-app
```

Templates:

- `single-app`
- `modular`

### Generate migrations

```bash
gn migrate:gen
gn migrate:gen --module ms-task
```

### Apply migrations

```bash
gn migrate:up
gn migrate:up --module ms-task
```

For modular projects, the CLI can prompt for a module when needed. For single-app projects, it auto-detects the layout from `src/db/models`.

## Requirements

- Bun `>= 1.3.11`
- TypeScript projects using ESM

## Installation

Install the package:

```bash
bun add glim-node
```

Install the integrations you actually use:

```bash
# Postgres
bun add pg drizzle-orm
bun add -d @types/pg drizzle-kit

# MySQL
bun add mysql2 drizzle-orm

# Redis
bun add ioredis

# AWS
bun add @aws-sdk/client-s3 @aws-sdk/client-sns
```

After installation, the binary is `gn`.

## App Shapes

### `createApp()`

Use this for a single service with no namespace in its environment variables.

```ts
import { createApp } from "glim-node";

export const app = await createApp({
  db: { type: "db.postgres" },
  cache: { type: "cache.redis" },
  notification: {
    type: "notification.sns",
    config: { topics: ["task-created"] },
  },
  statsApi: { type: "http.webservice" },
});
```

### `createModule(namespace, config)`

Use this for modular projects where each module owns its own namespaced resources.

```ts
import { createModule } from "glim-node";

export const tasks = await createModule("ms-task", {
  db: { type: "db.postgres" },
  cache: { type: "cache.redis" },
  storageAssets: { type: "storage.s3" },
  notification: {
    type: "notification.sns",
    config: { topics: ["task-created"] },
  },
});
```

## Supported Features

| Feature type       | Client exposed                  |
| ------------------ | ------------------------------- |
| `db.postgres`      | Drizzle PostgreSQL client       |
| `db.mysql`         | MySQL client                    |
| `cache.redis`      | `ioredis` client                |
| `storage.s3`       | Minimal S3 helper               |
| `notification.sns` | SNS publisher with typed topics |
| `http.webservice`  | Small typed HTTP client wrapper |

## Quick Start

### 1. Build an app

```ts
import { createApp } from "glim-node";
import { Hono } from "hono";

const router = new Hono().get("/health", (c) => c.json({ ok: true }));

export const app = await createApp({
  db: { type: "db.postgres" },
  cache: { type: "cache.redis" },
});

const hc = app.loadRouter(router);
export const client = hc("http://localhost:3000");
```

### 2. Start the server

```ts
import { start } from "glim-node/server";
import { app } from "./app";

await start(app);
```

`start()` accepts either a single app/module or an array.

## Environment Variable Conventions

Environment keys are derived from:

- the feature prefix, such as `DB`, `CACHE`, `STORAGE`, `NOTIFICATION`, or `HTTP`
- the module namespace, when using `createModule("ms-task", ...)`
- the config key alias, unless the alias is the default name for that feature

| Config                                                                    | Expected env prefix        |
| ------------------------------------------------------------------------- | -------------------------- |
| `db: { type: "db.postgres" }` in `createApp()`                            | `DB_*`                     |
| `db: { type: "db.postgres" }` in `createModule("ms-task", ...)`           | `DB_MS_TASK_*`             |
| `storageAssets: { type: "storage.s3" }` in `createApp()`                  | `STORAGE_ASSETS_*`         |
| `storageAssets: { type: "storage.s3" }` in `createModule("ms-task", ...)` | `STORAGE_MS_TASK_ASSETS_*` |

Minimal single-app example:

```env
APP_NAME="task-api"
APP_ENV="local"

DB_HOST="db:5432"
DB_DATABASE="postgres"
DB_USERNAME="postgres"
DB_PASSWORD="mypassword"

CACHE_HOST="cache"
CACHE_PORT="6379"
```

Minimal modular example:

```env
APP_NAME="task-api"
APP_ENV="local"

DB_MS_TASK_HOST="db:5432"
DB_MS_TASK_DATABASE="postgres"
DB_MS_TASK_USERNAME="postgres"
DB_MS_TASK_PASSWORD="mypassword"
```
