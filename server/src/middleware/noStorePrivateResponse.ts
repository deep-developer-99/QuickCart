import type { NextFunction, Request, Response } from "express";

/** Prevent browsers and shared proxies from retaining authenticated response bodies. */
export const noStorePrivateResponse = (_request: Request, response: Response, next: NextFunction) => {
  response.setHeader("Cache-Control", "no-store");
  next();
};
