# Glim Node

A TypeScript-first toolkit for building Node.js applications with Hono.js, featuring a powerful CLI for project scaffolding and management.

## Features

- 🚀 **Hono.js Integration**: A type-safe wrapper around Hono.js with built-in helpers for HTTP operations
- 📝 **Type Safety**: First-class TypeScript support with comprehensive type definitions
- 🔌 **Extensible**: Built-in support for common integrations (PostgreSQL, Redis, AWS)
- 🎯 **CLI Tool**: Interactive CLI for creating and managing Glim Node projects

## Installation

```bash
pnpm add github:ErickCReis/glim-node#semver:^0
```

## Quick Start

1. Create a new project:
```bash
pnpm dlx @ErickCReis/glim-node create
```

2. Start the development server:
```bash
cd my-app
docker compose up
```

## Usage Examples

### Module Setup (src/modules/my-module/index.ts)
```typescript
import { createModule } from '@ErickCReis/glim-node';
import { router } from './router';

// Create a module with integrations
const myModule = await createModule('my-module', {
  db: {
    type: 'db.postgres',
  },
  cache: {
    type: 'cache.redis',
  },
  storage: {
    type: 'storage.s3',
  },
  notification: {
    type: 'notification.sns',
    config: { topics: ['my-topic'] },
  },
});

// Load router with type-safe client
const hcWithType = myModule.loadRouter(router);
export const client = hcWithType('http://localhost:3000');

export { myModule };
```

### Server Start (src/index.ts)
```typescript
import { start } from '@ErickCReis/glim-node/server';
import { myModule } from './modules/my-module';

// Start the server with your module
start([myModule]);
```
