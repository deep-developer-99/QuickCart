import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { updateSearchSuggestionSettingsController } from "../../controllers/searchSuggestionController";
import SearchSuggestionSettings from "../../models/SearchSuggestionSettings";
import { serializeSearchSuggestionSettings } from "../searchSuggestionService";

test("search animation defaults apply to legacy settings and the schema validates timing bounds", async () => {
  const legacy = { isEnabled: false, rotationInterval: 3000 };
  assert.deepEqual(serializeSearchSuggestionSettings(legacy), {
    ...legacy, typingSpeedMs: 60, deletingSpeedMs: 40,
  });
  await new SearchSuggestionSettings({ typingSpeedMs: 20, deletingSpeedMs: 150 }).validate();
  await assert.rejects(
    new SearchSuggestionSettings({ typingSpeedMs: 19, deletingSpeedMs: 150.5 }).validate(),
    { message: /typingSpeedMs: .*deletingSpeedMs:/ },
  );
});

test("the settings endpoint rejects invalid speed values and accepts legacy updates", async (context) => {
  const persist = context.mock.method(SearchSuggestionSettings, "findOneAndUpdate", (_filter: unknown, update: { $set: unknown }) => update.$set);
  const writeSettings = async (body: unknown) => {
    const response = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; },
    };
    await updateSearchSuggestionSettingsController({ body } as Request, response as unknown as Response);
    return response;
  };

  const legacy = { isEnabled: true, rotationInterval: 2500 };
  for (const invalid of [{ typingSpeedMs: "60" }, { typingSpeedMs: 19 }, { deletingSpeedMs: 40.5 }, { deletingSpeedMs: 151 }]) {
    assert.equal((await writeSettings({ ...legacy, ...invalid })).statusCode, 400);
  }
  assert.equal(persist.mock.callCount(), 0);

  assert.equal((await writeSettings(legacy)).statusCode, 200);
  assert.deepEqual(persist.mock.calls[0]?.arguments[1]?.$set, legacy);

  const configured = { ...legacy, typingSpeedMs: 90, deletingSpeedMs: 25 };
  assert.deepEqual((await writeSettings(configured)).body, {
    success: true, message: "Rotation settings saved", data: configured,
  });
});
