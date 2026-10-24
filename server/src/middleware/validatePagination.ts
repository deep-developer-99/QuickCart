import { NextFunction, Request, Response } from "express";

export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  for (const [name, max] of [["page", 1_000_000], ["limit", 50]] as const) {
    const value = req.query[name];
    if (value === undefined) continue;
    const text = Array.isArray(value) ? "" : String(value);
    const parsed = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
      res.status(400).json({ success: false, message: `${name} must be a positive integer${name === "limit" ? " no greater than 50" : ""}` });
      return;
    }
  }
  next();
};
