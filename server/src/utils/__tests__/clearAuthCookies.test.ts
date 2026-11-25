import assert from "node:assert/strict";
import { test } from "node:test";
import type { Response } from "express";

import { clearAuthCookies } from "../clearAuthCookies";

test("clears the current root cookie and legacy route-scoped auth cookies", () => {
  const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
  const response = {
    clearCookie: (name: string, options: Record<string, unknown>) => {
      cleared.push({ name, options });
      return response;
    },
  } as unknown as Response;

  clearAuthCookies(response);

  assert.deepEqual(cleared.map(({ options }) => options.path), [
    "/",
    "/api/auth",
    "/api/auth/admin",
    "/api/auth/vendor",
    "/api/auth/phone",
  ]);
  assert.ok(cleared.every(({ name, options }) =>
    name === "token" && options.httpOnly === true && options.path !== undefined,
  ));
});
