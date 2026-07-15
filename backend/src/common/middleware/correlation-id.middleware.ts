import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export type RequestWithCorrelationId = Request & { correlationId?: string };

export function correlationIdMiddleware(
  req: RequestWithCorrelationId,
  res: Response,
  next: NextFunction
) {
  const incoming = req.header("x-request-id")?.trim();
  const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.correlationId = correlationId;
  res.setHeader("X-Request-Id", correlationId);
  next();
}
