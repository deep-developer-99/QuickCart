import { randomUUID } from "node:crypto";
import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";

type RequestLogContext = {
  requestId: string;
  method: string;
  path: string;
  startedAt: string;
  startedAtNs: bigint;
};

const REQUEST_ID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const HEALTH_PATH_PATTERN = /^\/(?:api\/)?(?:health|healthz|ready|live)\/?$/i;

const safePath = (request: Request): string => request.path.slice(0, 2048);

const getRequestId = (request: Request): string => {
  const candidate = request.get("x-request-id") ?? request.get("x-correlation-id");
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
};

const writeApiLog = (
  level: "info" | "error",
  event: string,
  fields: Record<string, unknown>,
): void => {
  const output = JSON.stringify({ level, scope: "API", event, ...fields });
  if (level === "error") console.error(output);
  else console.info(output);
};

const isApiRequest = (path: string): boolean =>
  path === "/api" || path.startsWith("/api/");

export const apiRequestLogger = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  const path = safePath(request);
  if (!isApiRequest(path)) {
    next();
    return;
  }

  if (
    HEALTH_PATH_PATTERN.test(path) &&
    process.env.API_LOG_HEALTH_CHECKS !== "true"
  ) {
    next();
    return;
  }

  const context: RequestLogContext = {
    requestId: getRequestId(request),
    method: request.method,
    path,
    startedAt: new Date().toISOString(),
    startedAtNs: process.hrtime.bigint(),
  };

  response.locals.requestId = context.requestId;
  response.setHeader("X-Request-Id", context.requestId);

  writeApiLog("info", "request.start", {
    timestamp: context.startedAt,
    method: context.method,
    path: context.path,
    requestId: context.requestId,
  });

  let finalized = false;
  const finalize = (aborted: boolean): void => {
    if (finalized) return;
    finalized = true;

    const durationMs = Number(process.hrtime.bigint() - context.startedAtNs) / 1_000_000;
    const statusCode = response.statusCode;
    writeApiLog("info", aborted ? "request.aborted" : "request.complete", {
      timestamp: context.startedAt,
      completedAt: new Date().toISOString(),
      method: context.method,
      path: context.path,
      statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      requestId: context.requestId,
      success: !aborted && statusCode < 400,
      completed: !aborted,
    });
  };

  response.once("finish", () => finalize(false));
  response.once("close", () => {
    if (!response.writableFinished) finalize(true);
  });

  next();
};

const getErrorMetadata = (error: unknown): {
  statusCode: number;
  errorName: string;
  errorCode?: string | number;
  stackFrames?: string;
} => {
  const candidate =
    error && typeof error === "object"
      ? (error as { status?: unknown; statusCode?: unknown })
      : undefined;
  const statusValue = candidate?.statusCode ?? candidate?.status;
  const statusCode =
    typeof statusValue === "number" &&
    Number.isInteger(statusValue) &&
    statusValue >= 400 &&
    statusValue <= 599
      ? statusValue
      : 500;

  if (!(error instanceof Error)) {
    return { statusCode, errorName: "NonErrorThrown" };
  }

  const code = (error as Error & { code?: unknown }).code;
  const errorCode =
    typeof code === "string" || typeof code === "number" ? code : undefined;
  const stackFrames =
    process.env.NODE_ENV === "development" && error.stack
      ? error.stack.split("\n").slice(1).join("\n").slice(0, 4000)
      : undefined;

  return {
    statusCode,
    errorName: error.name || "Error",
    ...(errorCode !== undefined ? { errorCode } : {}),
    ...(stackFrames ? { stackFrames } : {}),
  };
};

export const apiErrorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  next,
) => {
  const { statusCode, errorName, errorCode, stackFrames } =
    getErrorMetadata(error);
  const requestId =
    typeof response.locals.requestId === "string"
      ? response.locals.requestId
      : randomUUID();
  const path = safePath(request);

  if (statusCode >= 500) {
    writeApiLog("error", "request.error", {
      timestamp: new Date().toISOString(),
      method: request.method,
      path,
      statusCode,
      requestId,
      errorName,
      ...(errorCode !== undefined ? { errorCode } : {}),
      ...(stackFrames ? { stackFrames } : {}),
    });
  }

  if (response.headersSent) {
    next(error);
    return;
  }

  response.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? "Internal server error" : "Request could not be processed",
  });
};
