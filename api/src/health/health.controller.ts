import { Controller, Get, HttpCode, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process is up and serving. Never touches dependencies. */
  @Get('healthz')
  @HttpCode(200)
  healthz(): { status: 'ok'; service: string } {
    return { status: 'ok', service: process.env.SERVICE_NAME ?? 'api' };
  }

  /** Readiness: 200 when Postgres + Redis are reachable, else 503. */
  @Get('readyz')
  async readyz(@Res() res: Response): Promise<void> {
    const report = await this.health.readiness();
    res.status(report.ready ? 200 : 503).json({
      status: report.ready ? 'ready' : 'not-ready',
      checks: report.checks,
    });
  }
}
