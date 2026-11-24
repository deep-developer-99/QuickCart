import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import Category from "../../models/Category";
import MobileCategoryNavigation from "../../models/MobileCategoryNavigation";
import { getMobileCategoryNavigation, saveAdminMobileCategoryNavigation } from "../mobileCategoryNavigationController";

const first = new Types.ObjectId("64b000000000000000000001");
const second = new Types.ObjectId("64b000000000000000000002");
const missing = new Types.ObjectId("64b000000000000000000003");
const mock = (target: object, name: string, implementation: unknown) => {
  const original = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { configurable: true, writable: true, value: implementation });
  return () => original ? Object.defineProperty(target, name, original) : Reflect.deleteProperty(target, name);
};
const query = (value: unknown) => ({ select() { return this; }, sort() { return this; }, lean: async () => value });
const response = () => ({ statusCode: 200, body: null as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } });

test("public mobile navigation preserves order and omits disabled, inactive and missing categories", async () => {
  const restoreConfig = mock(MobileCategoryNavigation, "findOne", () => query({ items: [
    { category: second, isActive: true }, { category: first, displayName: "Fresh", isActive: true },
    { category: missing, isActive: true }, { category: second, isActive: false },
  ] }));
  const restoreCategories = mock(Category, "find", () => query([
    { _id: first, name: "Fruit", image: "https://example.com/fruit.png", isActive: true },
    { _id: second, name: "Pantry", isActive: false },
  ]));
  try {
    const res = response(); await getMobileCategoryNavigation({} as never, res as never);
    assert.equal(res.statusCode, 200);
    assert.deepEqual((res.body as { data: unknown[] }).data, [{ categoryId: String(first), name: "Fresh", image: "https://example.com/fruit.png", displayOrder: 1 }]);
  } finally { restoreCategories(); restoreConfig(); }
});

test("duplicate navigation categories are rejected before any write", async () => {
  let writes = 0;
  const restoreWrite = mock(MobileCategoryNavigation, "findOneAndUpdate", async () => { writes += 1; });
  try {
    const res = response();
    await saveAdminMobileCategoryNavigation({ body: { revision: 0, items: [
      { categoryId: String(first), isActive: true }, { categoryId: String(first), isActive: true },
    ] } } as never, res as never);
    assert.equal(res.statusCode, 400);
    assert.match((res.body as { message: string }).message, /only be added once/i);
    assert.equal(writes, 0);
  } finally { restoreWrite(); }
});

test("admin save preserves submitted order and uses one revision-checked configuration write", async () => {
  const categories = [
    { _id: first, name: "Fruit", isActive: true },
    { _id: second, name: "Pantry", isActive: true },
  ];
  const restoreCategory = mock(Category, "find", () => query(categories));
  const restoreConfig = mock(MobileCategoryNavigation, "findOne", () => query(null));
  let captured: { filter: Record<string, unknown>; update: { $set: { items: Array<{ category: Types.ObjectId; isActive: boolean }> } } } | undefined;
  const restoreWrite = mock(MobileCategoryNavigation, "findOneAndUpdate", async (filter: Record<string, unknown>, update: { $set: { items: Array<{ category: Types.ObjectId; isActive: boolean }> } }) => {
    captured = { filter, update };
    return { revision: 1 };
  });
  try {
    const res = response();
    await saveAdminMobileCategoryNavigation({ body: { revision: 0, items: [
      { categoryId: String(second), isActive: false },
      { categoryId: String(first), displayName: "Fresh", isActive: true },
    ] } } as never, res as never);
    assert.equal(res.statusCode, 200);
    assert.equal(captured?.filter.revision, 0);
    assert.deepEqual(captured?.update.$set.items.map(item => String(item.category)), [String(second), String(first)]);
    assert.deepEqual(captured?.update.$set.items.map(item => item.isActive), [false, true]);
  } finally { restoreWrite(); restoreConfig(); restoreCategory(); }
});
