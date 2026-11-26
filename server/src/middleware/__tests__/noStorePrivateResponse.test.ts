import { test } from "node:test";
import assert from "node:assert/strict";
import { noStorePrivateResponse } from "../noStorePrivateResponse";

test("authenticated response middleware prevents browser and proxy storage", () => {
  let cacheControl = "";
  let continued = false;
  noStorePrivateResponse(
    {} as never,
    { setHeader: (name: string, value: string) => { if (name === "Cache-Control") cacheControl = value; } } as never,
    () => { continued = true; },
  );
  assert.equal(cacheControl, "no-store");
  assert.equal(continued, true);
});
