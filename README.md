# StreamFlix

A high-performance video streaming platform designed to provide fast load times and smooth adaptive playback. It features a robust asynchronous transcode pipeline and utilizes a polyglot architecture for scalable media processing and rapid content delivery.

## Quick Start

```bash
# 1. Setup environment variables
cp infra/.env.example .env

# 2. Start infrastructure (Postgres, Redis, MinIO)
docker compose up -d postgres redis minio

# 3. Run migrations and seed data
pnpm migrate
pnpm seed

# 4. Start all services
docker compose up proxy api edge worker web

# 5. Open in browser
# http://localhost:8080
```

## Commands

| Command        | Description                     |
| -------------- | ------------------------------- |
| `pnpm migrate` | Run database migrations         |
| `pnpm seed`    | Seed database with initial data |
| `pnpm lint`    | Run linter across all packages  |
| `pnpm test`    | Run tests across all packages   |
| `pnpm build`   | Build all packages              |

## Architecture

The system utilizes a polyglot microservices architecture designed for performance and scalability:

- **Web Client**: React application utilizing `hls.js` for adaptive bitrate streaming.
- **API (BFF)**: NestJS application handling business logic, authentication, and triggering transcoding workflows via Temporal.
- **Transcode Worker**: CPU-bound Go worker that utilizes `ffmpeg` to asynchronously transcode uploaded videos into multi-bitrate HLS formats, saving outputs to MinIO.
- **Delivery Edge**: Latency-sensitive Go service that verifies signed URLs and serves HLS segments rapidly.
- **Infrastructure**: PostgreSQL for relational data, Temporal for workflow orchestration, Redis for pub/sub status updates & caching, and MinIO for S3-compatible object storage.

**System Architecture & Data Flow**:

```text
[ Web Client ]
 (React, hls.js)
       │
       ├── (1) Upload Video ───────▶ [ NestJS API / BFF ]
       │                                  │          │
       │                                  │          └──▶ (PostgreSQL)
       │                                  │
       │                                  ▼
       │                              (Temporal) ──▶ [ Go Transcode Worker ]
       │                               Workflow         (ffmpeg / MinIO)
       │                                  ▲                  │
       │                                  │   (Pub/Sub)      │
       │                                  └─── (Redis) ◀─────┘
       │
       └── (2) Stream Video ◀── [ CDN ] ◀── [ Go Edge ] ◀── (MinIO Storage)
                                             (HLS Server)    (Video Segments)
```

_For detailed architectural decisions, please refer to our [Architecture Decision Records (ADRs)](docs/adr/)._

## Implementation Status

- [x] **Media Pipeline**: Direct-to-MinIO upload & presigned URLs.
- [x] **Transcode Orchestration**: Go Worker scaling via Temporal Workflows.
- [x] **Playback**: HLS Adaptive Bitrate Streaming via `hls.js` & Delivery Edge.
- [x] **Core API**: Authentication, Catalog browsing, Watch Progress tracking.
- [ ] **Search**: Full-text search over titles/synopsis (Pending).
- [ ] **Recommendations**: Advanced recommendation engine (Pending).
- [ ] **Performance Engineering**: Cache tuning, Core Web Vitals optimization, and K6 Load Testing (Pending).
- [ ] **Cloud Deployment**: Migration from local Docker Compose to real S3/CDN (Pending).
