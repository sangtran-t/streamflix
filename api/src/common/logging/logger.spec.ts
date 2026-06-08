import { runWithContext } from './correlation';
import { StructuredLogger } from './structured-logger.service';

describe('StructuredLogger', () => {
  const logger = new StructuredLogger();

  it('emits a record with the required fields', () => {
    const rec = logger.buildRecord('log', 'hello', 'Bootstrap');
    expect(rec.level).toBe('log');
    expect(rec.service).toBe('api');
    expect(rec.msg).toBe('hello');
    expect(rec.context).toBe('Bootstrap');
    expect(typeof rec.ts).toBe('string');
    expect(() => new Date(rec.ts).toISOString()).not.toThrow();
  });

  it('includes the correlationId when inside a request context', () => {
    runWithContext({ correlationId: 'abc-123' }, () => {
      const rec = logger.buildRecord('log', 'in-context');
      expect(rec.correlationId).toBe('abc-123');
    });
  });

  it('omits correlationId outside any request context', () => {
    const rec = logger.buildRecord('log', 'no-context');
    expect(rec.correlationId).toBeUndefined();
  });

  it('serializes non-string messages without throwing', () => {
    const rec = logger.buildRecord('warn', { a: 1 });
    expect(rec.msg).toBe('{"a":1}');
  });
});
