import type { Response } from "express";

export const clearAuthCookies = (res: Response) => {
  const isProduction = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" as const : "lax" as const,
  };

  // Clear the root-scoped cookie plus default paths used by older login routes.
  for (const path of ["/", "/api/auth", "/api/auth/admin", "/api/auth/vendor", "/api/auth/phone"]) {
    res.clearCookie("token", { ...options, path });
  }
};
