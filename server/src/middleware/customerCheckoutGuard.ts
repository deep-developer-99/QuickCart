import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./authMiddleware";
import User from "../models/User";
import { activeCustomerFilter } from "../utils/customerLifecycle";

// Deactivation and checkout claim the same customer document atomically.
export const customerCheckoutGuard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return;
  const userId = req.user.id;
  try {
    const claimed = await User.updateOne({ _id: userId, ...activeCustomerFilter }, { $inc: { activeCheckoutRequests: 1 } });
    if (!claimed.matchedCount) {
      res.status(401).json({ success: false, code: "ACCOUNT_INACTIVE", message: "Your account is unavailable." });
      return;
    }
    // Keep the claim until the handler finishes, including on a disconnected
    // client. Releasing on close could let deletion race an ongoing payment.
    res.once("finish", () => {
      void User.updateOne({ _id: userId, activeCheckoutRequests: { $gt: 0 } }, { $inc: { activeCheckoutRequests: -1 } })
        .catch(() => console.error("A checkout claim needs operational review."));
    });
    next();
  } catch {
    res.status(503).json({ success: false, message: "Checkout is temporarily unavailable." });
  }
};
