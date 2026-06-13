# Montessori360

> Multi-tenant SaaS platform for Montessori schools, preschools, and early learning institutions.

## Repository Structure

```
montessori360/
├── apps/
│   ├── api/                  # Node.js 22 + Express 5 REST API
│   └── web/                  # Angular 17 admin portal (Phase 1 stub)
├── packages/
│   ├── database/             # node-pg-migrate migrations & schema
│   └── shared/               # Shared TypeScript types & constants
├── infra/
│   └── nginx/                # Nginx config (production reverse proxy)
├── scripts/                  # Utility scripts (tenant provisioning, etc.)
└── docs/                     # Architecture & design documents
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22 LTS+ |
| npm | 10+ |
| Redis | 7+ (local: `brew install redis` / `apt install redis-server`) |

PostgreSQL is hosted on **Aiven Cloud** — no local Postgres installation needed.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL` — copy from Aiven console → your service → **Overview → Connection information** → URI
- `REDIS_URL` — `redis://localhost:6379` for local dev
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — any random 32+ char strings

### 3. Start Redis locally

```bash
# macOS
brew services start redis

# Ubuntu / WSL
sudo systemctl start redis-server
```

### 4. Run database migrations

```bash
npm run db:migrate
```

This creates the `public.tenants`, `public.subscription_plans`, and `public.platform_admins` tables, and registers the `create_tenant_schema()` stored procedure on your Aiven database.

### 5. Provision a test tenant

```bash
node scripts/provision-tenant.js \
  --code testschool \
  --name "Test Montessori School" \
  --owner-name "Admin User" \
  --owner-email "admin@testschool.in" \
  --plan starter
```

This creates a `tenant_testschool` schema on Aiven with all Phase 1 tables.

### 6. Start the API server

```bash
npm run dev
# API: http://localhost:3000
# Health: GET http://localhost:3000/health
```

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | Public | Login — returns access token + sets refresh cookie |
| POST | `/api/v1/auth/refresh` | Cookie | Rotate access token |
| POST | `/api/v1/auth/logout` | Bearer | Invalidate refresh token |
| POST | `/api/v1/auth/forgot-password` | Public | Initiate password reset |
| POST | `/api/v1/auth/reset-password` | Public | Complete password reset |
| GET | `/api/v1/students` | Bearer | List students (tenant-scoped) |
| GET | `/api/v1/attendance/daily-summary` | Bearer | Daily attendance summary |
| GET | `/api/v1/fees/invoices` | Bearer | List fee invoices |
| GET | `/api/v1/communication/announcements` | Bearer | List announcements |

## Multi-tenancy

Each school is a **tenant** with:
- A row in `public.tenants` on Aiven
- A dedicated PostgreSQL schema (e.g. `tenant_sunshine123`)
- A short **tenant code** used at login (e.g. `sunshine123`)

JWT tokens carry `tenantId` and `tenantSchema`; all API requests are automatically scoped to the correct Aiven schema.

## Aiven SSL

The database config detects `aivencloud.com` in the connection string and enables SSL automatically. No extra setup needed — just paste the Aiven URI into `DATABASE_URL`.

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API in dev mode (nodemon + tsx) |
| `npm run build` | Compile TypeScript |
| `npm run db:migrate` | Run pending migrations on Aiven |
| `npm run db:migrate:undo` | Roll back last migration |
| `npm test` | Run all tests |
| `npm run lint` | ESLint all packages |

## Phase 1 Modules

- [x] Project scaffold & monorepo
- [x] Auth service (JWT, RBAC, multi-tenant)
- [x] Database schema (public + tenant template)
- [ ] Students module
- [ ] Attendance module
- [ ] Fees module
- [ ] Communication module
- [ ] Angular admin portal
