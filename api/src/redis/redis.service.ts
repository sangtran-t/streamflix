import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  /** Dedicated connection for SUBSCRIBE — ioredis blocks a client in subscriber mode. */
  private readonly subscriber: Redis;

  constructor() {
    const addr = process.env.REDIS_ADDR ?? 'localhost:6379';
    const [host, portRaw] = addr.split(':');
    const opts = {
      host,
      port: Number(portRaw ?? 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    };
    this.client = new Redis(opts);
    this.subscriber = new Redis(opts);
    this.client.on('error', (err) => this.logger.warn(`redis error: ${err.message}`));
    this.subscriber.on('error', (err) =>
      this.logger.warn(`redis subscriber error: ${err.message}`),
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      await this.subscriber.connect();
    } catch (err) {
      this.logger.warn(`redis not reachable at startup: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.subscriber.disconnect();
    this.client.disconnect();
  }

  async ping(): Promise<void> {
    const reply = await this.client.ping();
    if (reply !== 'PONG') {
      throw new Error(`unexpected redis PING reply: ${String(reply)}`);
    }
  }

  /**
   * Subscribe to a pub/sub channel.
   * `handler` is called with the raw message string on each publish.
   * Uses the dedicated subscriber connection (blocked for sub mode).
   */
  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) handler(msg);
    });
    this.logger.log(`Subscribed to pub/sub channel: ${channel}`);
  }
}
