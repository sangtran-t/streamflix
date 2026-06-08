import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

export type DependencyState = 'up' | 'down';

export interface ReadinessReport {
  ready: boolean;
  checks: Record<string, DependencyState>;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async readiness(): Promise<ReadinessReport> {
    const [postgres, redis] = await Promise.all([
      this.probe(() => this.dataSource.query('SELECT 1')),
      this.probe(() => this.redis.ping()),
    ]);
    const checks = { postgres, redis };
    return { ready: Object.values(checks).every((s) => s === 'up'), checks };
  }

  private async probe(fn: () => Promise<unknown>): Promise<DependencyState> {
    try {
      await fn();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
