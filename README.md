# D-Board — Enterprise Project Management & Collaboration Platform

D-Board is a modern, full-stack, enterprise-grade engineering workspace and project management platform built with TypeScript, React 19, Node.js, Express, PostgreSQL, Redis, and Socket.IO.

---

## 🌟 Key Features

- **Project Workspaces**: Multi-tenant workspace isolation with role-based access control (Admin, Member, Viewer).
- **Interactive Work Management**: Kanban boards, sprint task tracking, priorities, deadlines, and assignment workflows.
- **Calendar & Deadlines**: Multi-view project calendars with secure, revocable third-party calendar feed subscriptions (iCal/ICS).
- **Enterprise Storage & Document Management**:
  - Dual-driver storage architecture (Local filesystem or AWS S3).
  - Cryptographic content-addressed storage (CAS) with SHA-256 deduplication.
  - Strict MIME validation, binary magic number inspection, and safe SVG sanitization.
  - Safe spreadsheet previewing via isolated Web Worker sandbox.
- **Real-Time Collaboration**: Instant presence, notifications, and board updates powered by Socket.IO with Redis adapter.
- **Asynchronous Task Workers**: Background job processing powered by BullMQ and Redis for email notifications, deadline alerts, and file cleanup.
- **Observability & Diagnostics**:
  - Structured JSON logging with automated credential redaction.
  - End-to-end request correlation (`X-Request-Id`).
  - Liveness (`/api/health`) and readiness (`/api/ready`) probes.
  - Interactive OpenAPI 3.0 / Swagger documentation (`/api/docs`).

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Vanilla CSS Design System, Socket.IO Client, Vitest, React Testing Library |
| **Backend API** | Node.js 20, Express 5, TypeScript, Prisma ORM, Socket.IO, BullMQ, Helmet, Zod, Vitest, Supertest |
| **Data Stores** | PostgreSQL 16 (Local / Supabase PostgreSQL), Redis 7 / Valkey (Local / Render Key Value) |
| **Storage** | Provider-Neutral Content-Addressed Storage (Cloudflare R2, AWS S3, or Local Disk) |
| **Hosting & Cloud** | Free Tier: Render (Web Service + Static Site), Brevo (SMTP); Docker Compose for Local/Self-Hosted |
| **CI/CD** | GitHub Actions Pipeline (Typecheck, Lint, Unit Tests, Integration Tests, E2E Smoke Suite, Security Audit) |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+ and npm 10+
- PostgreSQL 16+ running locally on port 5432
- Redis 7+ running locally on port 6379

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the example environment file and adjust credentials:
```bash
cp apps/api/.env.example apps/api/.env
```

Ensure your `.env` contains:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/d_board?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
JWT_SECRET="<generate-with-openssl-rand-hex-32-min-32-chars>"
APP_URL="http://localhost:5000"
CLIENT_URL="http://localhost:5173"
STORAGE_DRIVER="local"
STORAGE_LOCAL_PATH="./uploads_storage"
MAX_FILE_SIZE_MB=50
```

### 4. Database Setup & Migrations
```bash
npx prisma generate --schema=apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

### 5. Run Development Servers
In separate terminals:
```bash
# Terminal 1: Backend API (port 5000)
npm run dev:api

# Terminal 2: Frontend Web Client (port 5173)
npm run dev:web
```

---

## ☁️ Free Cloud Deployment

Deploy D-Board completely free without AWS infrastructure:

- **Database**: Supabase PostgreSQL (Managed DB with Supabase Session Pooler on port 5432: `DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`)
- **Redis & Queues**: Render Key Value / Valkey (Generic `REDIS_URL` connection)
- **Object Storage**: Cloudflare R2 (S3-compatible bucket `d-board-files`, 10GB free, $0 egress fees)
- **Transactional Email**: Brevo SMTP (300 emails/day outbound limit)
- **Hosting**: Render (Web Service for API & embedded BullMQ worker + Static Site for React SPA)

Use the pre-configured [render.yaml](file:///c:/D-Board/render.yaml) blueprint:
1. Connect this repository to Render via **New + -> Blueprint**.
2. Supply your Supabase, Redis, Cloudflare R2, and Brevo credentials in the Render dashboard.
3. Deploy! Detailed steps are documented in the [Deployment Guide](file:///c:/D-Board/docs/deployment.md).

---

## 🧪 Testing

The repository maintains automated testing across all layers:

```bash
# Run all tests (API unit/integration, Web component, and E2E smoke)
npm run test

# Run backend tests only (Vitest)
npm run test:api

# Run frontend component tests only (Vitest + RTL)
npm run test:web

# Run deterministic end-to-end smoke test suite (10 critical user journeys)
npm run test:e2e
```

---

## 🐳 Docker Deployment

To launch the full production-ready stack (PostgreSQL, Redis, API, Worker, and Nginx Web client):

```bash
docker compose up -d --build
```

Access the services:
- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:5000](http://localhost:5000)
- **Swagger Documentation**: [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
- **OpenAPI Schema**: [http://localhost:5000/api/docs/openapi.json](http://localhost:5000/api/docs/openapi.json)
- **Liveness Probe**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **Readiness Probe**: [http://localhost:5000/api/ready](http://localhost:5000/api/ready)

---

## 📚 Technical Documentation & Runbooks

- [Architecture Specification](docs/architecture.md): Deep-dive into data models, queue topologies, and real-time synchronization.
- [Security Model & Threat Profile](docs/security.md): Authentication, RBAC, input sanitization, feed tokens, and residual risk registry.
- [Deployment Guide](docs/deployment.md): Infrastructure provisioning, Nginx reverse proxy configuration, and scaling policies.
- [Production Readiness Checklist](docs/production-checklist.md): Pre-flight checklists, operational alerts, and disaster recovery runbooks.

---

## 🛡️ License

Private enterprise repository. All rights reserved.
