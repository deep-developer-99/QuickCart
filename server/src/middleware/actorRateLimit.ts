import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./authMiddleware";

const requests = new Map<string, number[]>();

export const actorRateLimit = (scope: string, max: number, windowMs: number) => (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) { res.status(401).json({ success: false, message: "Authentication required" }); return; }
  const now = Date.now();
  const key = `${scope}:${req.user.role}:${req.user.id}`;
  const recent = (requests.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    res.status(429).json({ success: false, message: "Too many requests; try again later" });
    return;
  }
  recent.push(now);
  requests.set(key, recent);
  if (requests.size > 5000) {
    for (const [entry, times] of requests) {
      if (!times.some((time) => now - time < windowMs)) requests.delete(entry);
    }
  }
  next();
};
