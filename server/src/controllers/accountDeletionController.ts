import { createHash } from "node:crypto";
import { Types } from "mongoose";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import User from "../models/User";
import { AccountDeletionError, deactivateCustomer } from "../services/accountDeletionService";
import { clearAuthCookies } from "../utils/clearAuthCookies";

const logDeletionFailure = (res: Response, phase: "deactivation" | "throttling", error: unknown) => {
  const code = error instanceof Error ? (error as Error & { code?: unknown }).code : undefined;
  console.error(JSON.stringify({
    level: "error", event: "account_deletion.failed", phase, requestId: res.locals.requestId,
    errorName: error instanceof Error ? error.name : undefined,
    code: typeof code === "number" || typeof code === "string" ? code : undefined,
    indexIssues: error instanceof AccountDeletionError ? error.indexIssues : undefined,
  }));
};

const recentAuthenticationSeconds = 15 * 60;
const sessionDigest = (req: AuthenticatedRequest) =>
  createHash("sha256").update(req.cookies?.token || req.headers.authorization || "").digest("hex");

// A custom header and an exact Origin allowlist protect cookie requests.
// Native clients authenticate using a Bearer token and do not need an Origin.
export const protectAccountDeletion = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const cookieAuthenticated = Boolean(req.cookies?.token);
  const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";
  if (cookieAuthenticated && (req.get("Origin") !== new URL(allowedOrigin).origin || req.get("X-QuickCart-Account") !== "delete")) {
    res.status(403).json({ success: false, code: "INVALID_ORIGIN", message: "Please open account settings on the QuickCart website and try again." });
    return;
  }
  next();
};

export const getDeletionConfirmation = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return;
  res.set("Cache-Control", "no-store");
  if (!req.user.authenticatedAt || Date.now() / 1000 - req.user.authenticatedAt > recentAuthenticationSeconds) {
    res.status(403).json({ success: false, code: "REAUTH_REQUIRED", message: "Please sign in again to confirm it is you, then return to Account Privacy." });
    return;
  }
  const token = jwt.sign(
    { purpose: "delete-account", sub: req.user.id, session: sessionDigest(req) },
    process.env.JWT_SECRET as string,
    { expiresIn: "5m", audience: "quickcart-account-deletion" },
  );
  res.json({ success: true, confirmationToken: token });
};

export const deleteAccountController = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return;
  try {
    const token = req.body?.confirmationToken;
    if (typeof token !== "string") throw new AccountDeletionError("Please confirm deletion again.", 403, "CONFIRMATION_EXPIRED");
    let confirmation: JwtPayload;
    try {
      confirmation = jwt.verify(token, process.env.JWT_SECRET as string, { audience: "quickcart-account-deletion" }) as JwtPayload;
    } catch {
      throw new AccountDeletionError("Your confirmation expired. Close this dialog and try again.", 403, "CONFIRMATION_EXPIRED");
    }
    if (confirmation.purpose !== "delete-account" || confirmation.sub !== req.user.id || confirmation.session !== sessionDigest(req)) {
      throw new AccountDeletionError("Please confirm deletion again.", 403, "CONFIRMATION_EXPIRED");
    }
    if (!req.user.authenticatedAt || Date.now() / 1000 - req.user.authenticatedAt > recentAuthenticationSeconds) {
      throw new AccountDeletionError("Please sign in again before deleting your account.", 403, "REAUTH_REQUIRED");
    }
    await deactivateCustomer(req.user.id, req.body);
    clearAuthCookies(res);
    res.set("Cache-Control", "no-store").json({ success: true, message: "Your account has been deactivated." });
  } catch (error) {
    const known = error instanceof AccountDeletionError;
    if (!known || error.statusCode >= 500) logDeletionFailure(res, "deactivation", error);
    res.status(known ? error.statusCode : 500).json({
      success: false,
      code: known ? error.code : "DELETION_FAILED",
      message: known ? error.message : "We could not confirm account deletion. Please try again.",
    });
  }
};

// Database backed throttling works across server instances. The timestamp is
// internal and excluded from ordinary account responses.
export const limitAccountDeletion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return;
  try {
    const now = new Date();
    const field = req.path.endsWith("/confirmation") ? "confirmationAttemptAt" : "deletionAttemptAt";
    const windowSeconds = field === "confirmationAttemptAt" ? 10 : 5;
    const claimed = await User.collection.updateOne(
      { _id: new Types.ObjectId(req.user.id), $or: [
        { [field]: { $exists: false } },
        { [field]: { $lt: new Date(now.getTime() - windowSeconds * 1000) } },
      ] },
      { $set: { [field]: now } },
    );
    if (!claimed.modifiedCount) {
      const userAttempt = await User.collection.findOne(
        { _id: new Types.ObjectId(req.user.id) },
        { projection: { [field]: 1 } },
      );
      const attemptedAt = userAttempt?.[field] instanceof Date
        ? userAttempt[field].getTime()
        : new Date(userAttempt?.[field] ?? now).getTime();
      const retryAfter = Math.max(1, Math.ceil((attemptedAt + windowSeconds * 1000 - now.getTime()) / 1000));
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        retryAfterSeconds: retryAfter,
        message: `Please wait ${retryAfter} second${retryAfter === 1 ? "" : "s"} before trying again.`,
      });
      return;
    }
    next();
  } catch (error) {
    logDeletionFailure(res, "throttling", error);
    res.status(503).json({ success: false, message: "Account settings are temporarily unavailable." });
  }
};
