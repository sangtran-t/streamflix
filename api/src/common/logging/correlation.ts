import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  readonly correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export const CORRELATION_HEADER = 'x-correlation-id';
