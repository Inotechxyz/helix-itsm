# Helix Helpdesk

A modern, open-source ITSM (IT Service Management) platform for managing IT services, incidents, and support requests.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-20%2B-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)

## Overview

Helix Helpdesk provides a comprehensive solution for IT service management with features like incident tracking, service catalogs, knowledge bases, and change management - all in a multi-tenant architecture supporting multiple organizations.

## Key Features

| Category | Features |
|----------|----------|
| **Core ITSM** | Incident Management, Service Catalog, Knowledge Base, Problem Management, Change Management |
| **Asset Management** | Configuration Items (CMDB), Software License Tracking |
| **Operations** | SLA Policies, OLA Policies, Reporting & Analytics, CSAT Surveys |
| **Platform** | Multi-Tenant, Role-Based Access Control, Email Integration, File Attachments |
| **Authentication** | Azure AD SSO, Local Email/Password |

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/Inotechxyz/helix-itsm.git
cd helix-itsm

# Install dependencies
npm install

# Copy and configure environment files
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your database and Redis connection details
```

### Build Shared Packages

The shared packages must be built before the applications can compile:

```bash
# Build shared packages first (required)
npm run build --workspace=packages/shared
```

### Initialize Database

```bash
# Generate Prisma client
npm run db:generate -w apps/api

# Run database migrations
npm run db:migrate -w apps/api

# Seed the database with sample data
npm run db:seed -w apps/api


### Start Development Servers

```bash
# Start all development servers
npm run dev

# Or start individual apps
npm run start --workspace=apps/api      # API server on http://localhost:3000
npm run dev --workspace=apps/web      # Web frontend on http://localhost:5173
npm run start --workspace=apps/chatbot   # Chatbot service
npm run start --workspace=apps/worker   # Background worker
```

## Running Individual Apps

Each app can be run from its directory:

### API (NestJS Backend)

```bash
cd apps/api
npm run start        # Production mode
npm run start:dev    # Development with watch mode
npm run build        # Build for production
```

### Web (React Frontend)

```bash
cd apps/web
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
```

### Chatbot (AI Service)

```bash
cd apps/chatbot
npm run start        # Production mode
npm run start:dev    # Development with watch mode
npm run build        # Build for production
```

### Worker (Background Jobs)

```bash
cd apps/worker
npm run start        # Production mode
npm run start:dev    # Development with watch mode
npm run build        # Build for production
```

## Seed Data

The seed script creates sample data attached to a **Default Organization** for proper multi-tenant data isolation:

- **Default Organization**: "Default Organization" (slug: `default-org`) - hosts all superadmin data
- Admin & sample users (8 users - all with role `user` since UserRole enum has only `user` and `superadmin`)
- Teams (5): First Line Support, Technical Support, Development, Network Team, Security Team
- Ticket categories with subcategories (18 total)
- Knowledge base articles (3)
- Service catalog with services (10)
- Sample assets (servers, laptops, network devices) (15)
- Sample tickets (67), problems (4), and change requests (7)
- SLA/OLA policies (8)
- Software catalog with licenses (8 software, 7 licenses)

### Test Accounts


| Email | Role |
|-------|------|
| admin@helix.local | Superadmin (orgadmin for Default Organization) |
| john.smith@helix.local | User (IT Manager) |
| sarah.johnson@helix.local | User (Support Agent) |
| david.brown@helix.local | User (Requester) |


### Application URLs

- **Web App**: http://localhost:5173
- **API**: http://localhost:3000
- **API Docs**: http://localhost:3000/api/docs

## Common Issues

### Missing Module Declarations

If you encounter TypeScript errors about missing declaration files for `@helix/shared`, rebuild the shared packages:

```bash
# Fix for missing module declarations
cd packages/shared && npx tsc --build --clean && npx tsc
```

### Database Connection Issues

Ensure PostgreSQL and Redis are running and accessible. Check the `.env` file in `apps/api/` has correct connection strings:

```
DATABASE_URL=postgresql://user:password@localhost:5432/helix
REDIS_URL=redis://localhost:6379
```

## Using Docker

```bash
cd infra/docker

# With external PostgreSQL (Redis is included in the compose file)
docker-compose -f docker-compose.external-db.yml up -d --build

# Initialize database
docker exec -it helix-api npx prisma migrate deploy
docker exec -it helix-api npx ts-node ../../prisma/seed.ts
```

> **Note**: `docker-compose.external-db.yml` includes Redis as a managed service. If you have an existing Redis container, either stop it or update `REDIS_URL` in `.env` to point to your external Redis.

### Docker Ports
| Service | Port |
|---------|------|
| Web | http://localhost:8080 |
| API | http://localhost:3000 |
| Chatbot | http://localhost:3001 |
| Swagger | http://localhost:3000/api/docs |

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand |
| Backend | NestJS, Prisma ORM, PostgreSQL, Redis, Bull |
| Infrastructure | Docker |

## Project Structure

```
helix-helpdesk/
├── apps/
│   ├── api/              # NestJS backend API (port 3000)
│   ├── web/              # React frontend (port 5173)
│   ├── chatbot/          # AI chatbot service
│   └── worker/           # Background job processor
├── packages/
│   ├── shared/           # Shared types, enums, and utilities (@helix/shared)
│   └── config/           # Shared TypeScript and ESLint configurations
├── prisma/               # Database schema and seed script
└── infra/                # Docker configs
```


## License Tiers

| Tier | Modules |
|------|---------|
| **Basic** | Tickets, Service Catalog |
| **Standard** | Tickets, Problems, Knowledge Base, Service Catalog |
| **Premium** | Standard + Changes, Assets, Software Licenses, Reports |
| **Enterprise** | Premium + SLA Policies, OLA Policies |

### API Module Protection

The API enforces module-level access control based on organization license tier. Organizations without the proper license tier will receive a `403 Forbidden` response when attempting to access protected module endpoints.

Protected modules include:

- **Tickets** - `tickets` module (Basic tier+)
- **Service Catalog** - `service_catalog` module (Basic tier+)
- **Knowledge Base** - `knowledge_base` module (Standard tier+)
- **Problems** - `problems` module (Standard tier+)
- **Changes** - `changes` module (Premium tier+)
- **Assets** - `assets` module (Premium tier+)
- **Software Licenses** - `software_licenses` module (Premium tier+)
- **Reports** - `reports` module (Premium tier+)
- **SLA Policies** - `sla_policies` module (Enterprise tier+)
- **OLA Policies** - `ola_policies` module (Enterprise tier+)

> This repository contains the **open source version** under MIT license. Commercial licenses for extended features are available separately.

## License

MIT License - see [LICENSE](LICENSE) file for details.