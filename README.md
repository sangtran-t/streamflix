# StreamFlix

A production-grade, **lawfully-sourced** video streaming platform — built as a
Senior SWE portfolio piece. Focus: fast load & smooth adaptive playback, a real
transcode pipeline, and a defensible polyglot architecture, all backed by
**measured** performance numbers.

> All demo content is Creative Commons / public domain. See `CREDITS.md`.

## What it demonstrates

- **Media pipeline:** upload → async transcode (ffmpeg) → multi-bitrate HLS.
- **Adaptive streaming:** hls.js ABR for fast first frame + low rebuffering.
- **Polyglot design with intent:** NestJS for the logic-rich API/BFF, Go for the
  CPU-bound transcode worker and the latency-sensitive delivery edge.
- **Performance engineering:** caching tiers, Core Web Vitals, before/after metrics.
- **Operational maturity:** ADRs, runbook, tests, load tests, observability.

## Architecture at a glance

React (hls.js) → NestJS API/BFF → Postgres / Redis
NestJS enqueues jobs → Go transcode worker (ffmpeg) → object storage
Go delivery edge verifies signed URLs and serves HLS (CDN in cloud).

Full reasoning in [`docs/PLAN.md`](docs/PLAN.md) and the ADRs in [`docs/adr/`](docs/adr/).

## Documentation

| Doc                                      | What's in it                                       |
| ---------------------------------------- | -------------------------------------------------- |
| [docs/PLAN.md](docs/PLAN.md)             | Vision, scope, architecture, roadmap, targets      |
| [docs/adr/](docs/adr/)                   | Why each major decision was made (+ trade-offs)    |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Schema & entities                                  |
| [docs/METRICS.md](docs/METRICS.md)       | What we measure and the targets                    |
| docs/API.md                              | REST API contracts, error shape, auth, rate limits |
| docs/RUNBOOK.md                          | Run & operate locally; config & secrets matrix     |

## Status

Phase 0 (Foundations) scaffolding landed: monorepo layout, Docker Compose stack
(Postgres/Redis/MinIO + single-origin dev proxy), TypeORM entities + initial
migration (ADR-0009), `/healthz`+`/readyz` on api/edge/worker, structured logging
with `correlationId`, idempotent seed, and the CI/PR governance gate. See
[`PHASE0_HANDOFF.md`](PHASE0_HANDOFF.md) for what was verified and the commands to
finish bring-up locally. Next: Phase 1 — the end-to-end playback slice.

## Quickstart

```bash
cp infra/.env.example .env
docker compose up -d postgres redis minio   # infra first
pnpm migrate                                # apply TypeORM migrations
pnpm seed                                   # idempotent: metadata + pre-transcoded clip
docker compose up proxy api edge worker web
# open http://localhost:8080
```

## Governance & process (how quality stays consistent)

This is a solo project held to a production-grade, Senior bar via process, not
headcount. See:

| Doc                                                            | Purpose                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                         | Rules any AI agent must follow in this repo                 |
| [CONTRIBUTING.md](CONTRIBUTING.md)                             | The human-facing workflow (mirrors CLAUDE.md)               |
| [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) | Concrete, checkable "Senior" standards                      |
| [docs/roles/](docs/roles/)                                     | Review lenses (Architect, Backend, Frontend, Reviewer, SRE) |
| [docs/REVIEW_CHECKLIST.md](docs/REVIEW_CHECKLIST.md)           | The merge gate / Definition of Done                         |
| [docs/AI_COLLABORATION.md](docs/AI_COLLABORATION.md)           | How to drive the project with Cowork/Claude Code            |
| [.github/](.github/)                                           | PR template, CODEOWNERS, CI that enforces the bar           |

The model: the agent implements + self-reviews through every role lens, CI
mechanically enforces the floor (incl. Nest↔Go contract drift), and the
maintainer holds the gate and guards the ADRs.
