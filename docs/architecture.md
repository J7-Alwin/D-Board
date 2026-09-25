# D-Board Architecture Specification

This document details the architectural design, component interactions, data flows, and infrastructure models of D-Board.

---

## 1. System Overview

D-Board is structured as an enterprise-grade monorepo containing a REST + WebSocket backend API and a responsive Single Page Application (SPA) frontend.

```mermaid
graph TD
    Client[Web Browser SPA] -->|HTTP / REST| API[Express API Server]
    Client -->|WebSocket| WSS[Socket.IO Server]
    API -->|ORM / SQL Queries| PG[(PostgreSQL 16)]
    API -->|Cache / Sessions / PubSub| Redis[(Redis 7)]
    WSS -->|PubSub Subscription| Redis
    API -->|Enqueue Jobs| BullMQ[BullMQ Job Queues]
    BullMQ -->|Job State| Redis
    Worker[Background Worker Process] -->|Consume Jobs| BullMQ
    Worker -->|Transactional State| PG
    API -->|Store & Retrieve Files| Storage{Storage Driver}
    Storage -->|Driver = local| FS[(Local Filesystem / Content-Addressed)]
    Storage -->|Driver = s3| S3[(Cloudflare R2 / S3 Presigned URLs)]
```

---

## 2. Monorepo Organization

```
D-Board/
├── apps/
│   ├── api/                     # Backend API server & background workers
│   │   ├── prisma/              # Prisma schema, migrations, and seeds
│   │   ├── src/
│   │   │   ├── config/          # Environment configuration & Zod validation
│   │   │   ├── controllers/     # HTTP route handlers
│   │   │   ├── docs/            # OpenAPI 3.0 specification & Swagger UI
│   │   │   ├── jobs/            # BullMQ queues, job schemas, and workers
│   │   │   ├── middlewares/     # Auth, error, rate limiting, request ID, security
│   │   │   ├── realtime/        # Socket.IO gateway and room management
│   │   │   ├── redis/           # Centralized Redis connection and caching
│   │   │   ├── routes/          # Express route registration
│   │   │   ├── schemas/         # Zod request validation schemas
│   │   │   ├── services/        # Domain business logic & data manipulation
│   │   │   ├── storage/         # Pluggable storage abstraction (Local & S3)
│   │   │   ├── tests/           # Vitest unit & integration test suites
│   │   │   ├── utils/           # Structured logging, token hashing, helpers
│   │   │   ├── server.ts        # Express app bootstrap & HTTP listener
│   │   │   └── worker.ts        # Standalone queue worker process
│   │   ├── Dockerfile           # Multi-stage production container
│   │   └── package.json
│   └── web/                     # Frontend Single Page Application
│       ├── src/
│       │   ├── components/      # UI components, layout, modals, navigation
│       │   ├── contexts/        # React Context providers (Auth, Socket, Theme)
│       │   ├── hooks/           # Custom React hooks
│       │   ├── pages/           # Application views and routes
│       │   ├── services/        # HTTP API client and WebSocket service
│       │   ├── styles/          # Vanilla CSS design system tokens and utilities
│       │   ├── tests/           # Vitest + React Testing Library component tests
│       │   ├── utils/           # Formatting, date helpers, sanitization
│       │   └── workers/         # Sandboxed Web Workers (XLSX parsing)
│       ├── nginx.conf           # Production Nginx reverse proxy configuration
│       ├── Dockerfile           # Multi-stage Nginx Alpine SPA container
│       └── package.json
├── docs/                        # Engineering specifications & runbooks
├── e2e/                         # Deterministic end-to-end smoke test suite
├── docker-compose.yml           # Local production orchestration
└── package.json                 # Monorepo workspaces manifest
```

---

## 3. Request Lifecycle & Middleware Chain

Every inbound HTTP request to the D-Board API flows through a deterministic middleware pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant ID as RequestIdMiddleware
    participant Sec as Helmet & CORS
    participant RL as RateLimiter (Redis)
    participant Auth as AuthMiddleware
    participant Val as ZodValidationMiddleware
    participant Ctrl as Controller & Service
    participant Err as ErrorMiddleware

    Client->>ID: Inbound Request (optional X-Request-Id)
    ID->>ID: Assign or generate cryptographic UUIDv4
    ID->>Sec: Forward with req.id
    Sec->>RL: Enforce CSP, HSTS, frame options, CORS origin
    RL->>RL: Check Redis sliding window rate limits
    alt Rate Limit Exceeded
        RL-->>Client: 429 Too Many Requests (Retry-After header)
    else Under Limit
        RL->>Auth: Forward
    end
    alt Protected Route
        Auth->>Auth: Validate JWT / Session Token from HTTP-only Cookie
        alt Invalid / Expired Session
            Auth-->>Client: 401 Unauthorized
        else Authorized
            Auth->>Val: Attach req.user (userId, role)
        end
    else Public Route
        Auth->>Val: Pass-through
    end
    Val->>Val: Parse & validate body/query/params against Zod schema
    alt Validation Failed
        Val-->>Client: 400 Bad Request (Formatted Zod issues)
    else Valid
        Val->>Ctrl: Invoke business logic
    end
    alt Logic Success
        Ctrl-->>Client: 200/201 JSON Response + X-Request-Id Header
    else Exception Thrown
        Ctrl->>Err: Catch error
        Err->>Err: Log error with req.id and stack trace
        Err-->>Client: Formatted JSON { success: false, error: { message, code, requestId } }
    end
```

---

## 4. Real-Time Communication Architecture

D-Board utilizes **Socket.IO** connected to Redis for real-time messaging, collaboration, and state propagation:

1. **Authentication Handshake**:
   - Web clients connect to the Socket.IO server via WebSocket (falling back to long-polling).
   - The connection handshake parses the HTTP-only cookie and validates the JWT against PostgreSQL/Redis. Unauthenticated sockets are disconnected immediately.
2. **Room Isolation**:
   - Sockets join project-specific rooms: `project:<projectId>`.
   - User-specific notification rooms: `user:<userId>`.
3. **Event Propagation**:
   - When a resource is modified (e.g. task moved, comment added, file uploaded), the service layer emits an event (`TASK_UPDATED`, `FILE_UPLOADED`, `MEMBER_REMOVED`).
   - If a member is revoked or removed from a project, an `evictUserFromProjectRoom` command removes their socket immediately and dispatches an eviction event to their client.

---

## 5. Background Task Processing (BullMQ & Redis)

Long-running or I/O-heavy operations are decoupled from HTTP request lifecycles using BullMQ queues:

- **`email` Queue**: Handles verification emails, password resets, project invitations, and task assignments with automatic retries and exponential backoff.
- **`deadlines` Queue**: Regularly scans for upcoming task deadlines and dispatches reminder notifications.
- **`cleanup` Queue**: Sweeps expired invitations, orphaned temporary files, and unlinked stored objects.

Workers run either embedded inside the API process or as an independently scalable `worker` container.

---

## 6. Storage & Content-Addressed Deduplication Architecture

D-Board implements a pluggable dual-driver storage service:

1. **Local Content-Addressed Storage (`STORAGE_DRIVER=local`)**:
   - Files are hashed via SHA-256 upon stream intake.
   - Files with identical binary content share the same underlying `StoredObject` record on disk (`/uploads_storage/<hash>`), saving significant disk storage.
   - Multiple `Attachment` records reference the same `StoredObject` via foreign key relationship.
2. **Cloudflare R2 / AWS S3 (`STORAGE_DRIVER=s3`)**:
   - Provider-neutral S3-compatible driver using AWS SDK v3.
   - Configured via `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET` (defaults to `d-board-files`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
   - Generates short-lived presigned URLs for secure time-limited downloads without public bucket exposure.
   - Project-scoped content-addressed deduplication (`projectId + contentHash`) maps duplicate attachments to a single `StoredObject`.
3. **Security Invariants**:
   - Magic byte inspection verifies declared MIME types against actual binary headers (preventing executable masquerading).
   - SVG files are disinfected via DOMPurify to strip script tags and onload handlers.
   - Spreadsheets are parsed in an isolated Web Worker (`src/workers/spreadsheet.worker.ts`) without access to the DOM, `window`, `document`, or cookies. Standard worker environment primitives (such as `fetch`) remain present in the worker context; defense is achieved via thread separation, disabling macros (`bookVBA: false`), disabling external workbook dependencies (`bookDeps: false`), and capping payload bounds (`maxSheets: 20`, `maxRows: 5000`).

---

## 7. Database Architecture & Integrity Rules

- **Connection Architecture**:
  - **Render Persistent Express API → Prisma → Supabase PostgreSQL**:
  - In Render production environments, the persistent API server and Prisma migrations connect to Supabase PostgreSQL using the **Supabase Session Pooler** on port `5432`:
    `DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`
  - The port 5432 session pooler supports persistent connections, prepared statements, and transactional safety required by Prisma without the connection limitations of port 6543 transaction poolers.
- **Foreign Key Cascades**:
  - Deleting a `Project` cascades to its `ProjectMember`, `WorkItem`, `CalendarEvent`, `Folder`, and `Note` records.
  - Deleting a `User` cascades to user-owned relations while updating task assignments to `null` to preserve audit history.
- **Archival Protection**:
  - Projects marked `isArchived = true` reject all mutating API operations (`POST`, `PATCH`, `DELETE`) with HTTP `400 Bad Request`.
- **Calendar Feed Security**:
  - Feed tokens are generated with 256-bit cryptographically secure random bytes.
  - Plaintext tokens are NEVER stored in the database; only SHA-256 HMAC hashes are stored, preventing feed exposure even in the event of database dumps.

---

## 8. Observability & Error Monitoring

- **Structured Logging**: Single-line JSON logging in production (`src/utils/logger.ts`) with automated recursive secret redaction for authentication tokens, passwords, and keys.
- **Request Tracing**: Cryptographic UUID `X-Request-Id` correlation injected via `src/middlewares/requestId.middleware.ts` across logs and client response envelopes.
- **Health & Readiness Probes**: Liveness at `/api/health` and multi-dependency readiness probe at `/api/ready` (PostgreSQL, Redis, storage driver, and BullMQ queues).
- **External Error Monitoring**: Structured logging and request correlation are implemented; external error monitoring/alerting remains a deployment requirement.
