import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { v4 as uuidv4 } from 'uuid';

import { CORRELATION_HEADER, runWithContext } from './correlation';

/**
 * Reads an inbound X-Correlation-Id header or mints a new UUID, binds it to
 * the async context for the request lifetime, and echoes it on the response.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers[CORRELATION_HEADER];
    const correlationId = (Array.isArray(inbound) ? inbound[0] : inbound)?.trim() || uuidv4();

    res.setHeader(CORRELATION_HEADER, correlationId);
    runWithContext({ correlationId }, () => next());
  }
}
