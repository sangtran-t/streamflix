import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { getCorrelationId } from './correlation';

const SERVICE = process.env.SERVICE_NAME ?? 'api';

interface LogRecord {
  ts: string;
  level: string;
  service: string;
  msg: string;
  correlationId?: string;
  context?: string;
  [field: string]: unknown;
}

/**
 * Structured JSON logger — one JSON object per line:
 *   { ts, level, service, correlationId, context, msg, ...fields }
 *
 * Errors go to stderr; everything else to stdout.
 */
@Injectable()
export class StructuredLogger extends ConsoleLogger {
  /** Exposed for unit testing without capturing stdout. */
  buildRecord(level: LogLevel, message: unknown, context?: string): LogRecord {
    const record: LogRecord = {
      ts: new Date().toISOString(),
      level,
      service: SERVICE,
      msg: this.stringify(message),
    };
    const correlationId = getCorrelationId();
    if (correlationId) record.correlationId = correlationId;
    if (context) record.context = context;
    return record;
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.message;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private emit(level: LogLevel, message: unknown, context?: string): void {
    const line = JSON.stringify(this.buildRecord(level, message, context));
    if (level === 'error' || level === 'fatal') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
  }

  log(message: unknown, context?: string): void {
    this.emit('log', message, context);
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    const record = this.buildRecord('error', message, context ?? stackOrContext);
    if (context && stackOrContext) record.stack = stackOrContext;
    process.stderr.write(JSON.stringify(record) + '\n');
  }

  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.emit('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.emit('verbose', message, context);
  }
}
