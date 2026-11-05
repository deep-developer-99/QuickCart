import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

import Admin from "../../models/Admin";
import User from "../../models/User";
import authMiddleware, { type AuthenticatedRequest } from "../authMiddleware";

const restoreMethod = (target: object, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(target, key, previous);
    else Reflect.deleteProperty(target, key);
  };
};

test("homepage section admin authorization accepts active admins and rejects users", async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "homepage-sections-test-secret";
  const restoreAdmin = restoreMethod(Admin, "findById", () => ({ select: async () => ({ _id: "admin-id", isActive: true }) }));
  const restoreUser = restoreMethod(User, "findById", () => ({ select: async () => ({ _id: "user-id" }) }));

  const execute = async (role: "admin" | "user", id: string) => {
    const response = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    const request = {
      cookies: { token: jwt.sign({ id, role }, process.env.JWT_SECRET as string) },
      headers: {},
    } as unknown as AuthenticatedRequest;
    let passed = false;
    await authMiddleware("admin")(request, response as never, (() => { passed = true; }) as never);
    return { response, passed };
  };

  try {
    const admin = await execute("admin", "admin-id");
    assert.equal(admin.passed, true);
    assert.equal(admin.response.statusCode, 200);

    const user = await execute("user", "user-id");
    assert.equal(user.passed, false);
    assert.equal(user.response.statusCode, 403);
  } finally {
    restoreUser();
    restoreAdmin();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
