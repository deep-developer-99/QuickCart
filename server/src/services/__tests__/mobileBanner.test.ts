import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import Category from "../../models/Category";
import MobileBanner from "../../models/MobileBanner";
import Product from "../../models/Product";
import cloudinary from "../../config/cloudinary";
import { createMobileBanner, deleteMobileBanner, getPublicMobileBanners, removeUnusedMobileBannerImage, reorderMobileBanners, setMobileBannerStatus, validateMobileBannerInput } from "../mobileBannerService";
import { createMobileBannerController, updateMobileBannerController } from "../../controllers/mobileBannerController";

const idA = new Types.ObjectId("64b000000000000000000011");
const idB = new Types.ObjectId("64b000000000000000000012");
const idC = new Types.ObjectId("64b000000000000000000013");
const stub = (target: object, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => previous ? Object.defineProperty(target, key, previous) : Reflect.deleteProperty(target, key);
};
const query = (result: unknown) => ({ select() { return this; }, sort() { return this; }, lean: async () => result });

test("MobileBanner has its own collection, schedule fields and ordered active index", () => {
  assert.equal(MobileBanner.collection.name, "mobilebanners");
  assert.ok(MobileBanner.schema.indexes().some(([fields]) => fields.isActive === 1 && fields.displayOrder === 1));
  assert.ok(MobileBanner.schema.path("startDate"));
  assert.ok(MobileBanner.schema.path("endDate"));
});

test("public mobile banner feed excludes invalid destinations and returns only safe fields in saved order", async () => {
  let filter: Record<string, unknown> = {};
  const restoreBanner = stub(MobileBanner, "find", (value: Record<string, unknown>) => { filter = value; return query([
    { _id: idB, title: "Second", image: "https://example.com/b.png", redirectType: "product", redirectTarget: String(idC), displayOrder: 1, imagePublicId: "secret" },
    { _id: idA, title: "First", image: "https://example.com/a.png", redirectType: "category", redirectTarget: String(idA), displayOrder: 2 },
    { _id: idC, title: "Stale", image: "https://example.com/c.png", redirectType: "category", redirectTarget: String(idB), displayOrder: 3 },
  ]); });
  const restoreCategory = stub(Category, "find", () => query([{ _id: idA, parentCategory: null }]));
  const restoreProduct = stub(Product, "find", () => query([{ _id: idC }]));
  try {
    const items = await getPublicMobileBanners();
    assert.equal(filter.isActive, true);
    assert.ok(Array.isArray(filter.$and));
    assert.deepEqual(items.map(item => item.title), ["Second", "First"]);
    assert.equal("imagePublicId" in items[0], false);
  } finally { restoreProduct(); restoreCategory(); restoreBanner(); }
});

test("mobile banner validation rejects invalid order and missing redirect before writes", async () => {
  const base = { title: "Sale", redirectType: "none" as const, displayOrder: 0, isActive: true };
  await validateMobileBannerInput({ redirectType: "none", displayOrder: 0, isActive: true });
  await assert.rejects(validateMobileBannerInput({ ...base, displayOrder: -1 }), /order/i);
  await assert.rejects(validateMobileBannerInput({ ...base, redirectType: "product", redirectTarget: "bad" }), /destination/i);
  await assert.rejects(validateMobileBannerInput({ ...base, startDate: new Date("2026-12-02"), endDate: new Date("2026-12-01") }), /End date/i);
});

test("Admin create, activation and deletion use only the MobileBanner model", async () => {
  const events: string[] = [];
  const document = { _id: idA, title: "Sale", image: "https://example.com/sale.png", imagePublicId: "quickcart/mobile-banners/sale", isActive: true,
    save: async () => { events.push("saved"); }, deleteOne: async () => { events.push("deleted"); } };
  const restoreCreate = stub(MobileBanner, "create", async () => { events.push("created"); return document; });
  const restoreFind = stub(MobileBanner, "findById", async () => document);
  try {
    await createMobileBanner({ title: "Sale", image: document.image, imagePublicId: document.imagePublicId, redirectType: "none", displayOrder: 0, isActive: true });
    await setMobileBannerStatus(String(idA), false);
    assert.equal(document.isActive, false);
    await deleteMobileBanner(String(idA));
    assert.deepEqual(events, ["created", "saved", "deleted"]);
  } finally { restoreFind(); restoreCreate(); }
});

test("reorder persists each banner position and rejects incomplete lists", async () => {
  let operations: Array<{ updateOne: { filter: { _id: Types.ObjectId }; update: { $set: { displayOrder: number } } } }> = [];
  const restoreFind = stub(MobileBanner, "find", () => query([{ _id: idA }, { _id: idB }]));
  const restoreWrite = stub(MobileBanner, "bulkWrite", async (value: typeof operations) => { operations = value; });
  try {
    await assert.rejects(reorderMobileBanners([String(idA)]), /every mobile banner/i);
    await reorderMobileBanners([String(idB), String(idA)]);
    assert.deepEqual(operations.map(op => [String(op.updateOne.filter._id), op.updateOne.update.$set.displayOrder]), [[String(idB), 0], [String(idA), 1]]);
  } finally { restoreWrite(); restoreFind(); }
});

test("Cloudinary cleanup removes only unreferenced mobile banner images", async () => {
  let references = true;
  let deletes = 0;
  const restoreExists = stub(MobileBanner, "exists", async () => references);
  const restoreDestroy = stub(cloudinary.uploader, "destroy", async () => { deletes += 1; });
  try {
    await removeUnusedMobileBannerImage("quickcart/mobile-banners/asset");
    await removeUnusedMobileBannerImage("quickcart/banners/website-asset");
    assert.equal(deletes, 0);
    references = false;
    await removeUnusedMobileBannerImage("quickcart/mobile-banners/asset");
    assert.equal(deletes, 1);
  } finally { restoreDestroy(); restoreExists(); }
});

const response = () => ({ statusCode: 200, body: null as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } });
const validBody = { redirectType: "none", redirectTarget: "", displayOrder: "0", isActive: "true", startDate: "", endDate: "" };

test("Admin creates a mobile banner without a title field", async () => {
  let savedTitle = "";
  const restoreUpload = stub(cloudinary.uploader, "upload_stream", (_options: unknown, callback: (error: null, result: { secure_url: string; public_id: string }) => void) => ({ end: () => callback(null, { secure_url: "https://example.com/new.png", public_id: "quickcart/mobile-banners/new" }) }));
  const restoreCreate = stub(MobileBanner, "create", async (input: { title: string }) => {
    savedTitle = input.title;
    return input;
  });
  try {
    const res = response();
    await createMobileBannerController({ body: validBody, file: { buffer: Buffer.from("image") } } as never, res as never);
    assert.equal(res.statusCode, 201);
    assert.match(savedTitle, /^Mobile banner [a-f0-9]{8}$/);
  } finally { restoreCreate(); restoreUpload(); }
});

test("image replacement saves the new mobile image before deleting the unreferenced old image", async () => {
  const oldId = "quickcart/mobile-banners/old";
  const newId = "quickcart/mobile-banners/new";
  const document = { image: "https://example.com/old.png", imagePublicId: oldId, title: "Old", redirectType: "none", displayOrder: 0, isActive: true, save: async () => { events.push("saved"); } };
  const events: string[] = [];
  const restoreFind = stub(MobileBanner, "findById", async () => ({ ...document }));
  const restoreExists = stub(MobileBanner, "exists", async () => false);
  const restoreUpload = stub(cloudinary.uploader, "upload_stream", (_options: unknown, callback: (error: null, result: { secure_url: string; public_id: string }) => void) => ({ end: () => callback(null, { secure_url: "https://example.com/new.png", public_id: newId }) }));
  const restoreDestroy = stub(cloudinary.uploader, "destroy", async (id: string) => { events.push(`deleted:${id}`); });
  try {
    const res = response();
    await updateMobileBannerController({ params: { id: String(idA) }, body: validBody, file: { buffer: Buffer.from("image") } } as never, res as never);
    assert.equal(res.statusCode, 200);
    assert.equal((res.body as { data: { title: string } }).data.title, "Old");
    assert.deepEqual(events, ["saved", `deleted:${oldId}`]);
  } finally { restoreDestroy(); restoreUpload(); restoreExists(); restoreFind(); }
});

test("failed mobile banner creation deletes the newly uploaded Cloudinary image", async () => {
  const newId = "quickcart/mobile-banners/failed";
  const deleted: string[] = [];
  const restoreUpload = stub(cloudinary.uploader, "upload_stream", (_options: unknown, callback: (error: null, result: { secure_url: string; public_id: string }) => void) => ({ end: () => callback(null, { secure_url: "https://example.com/new.png", public_id: newId }) }));
  const restoreCreate = stub(MobileBanner, "create", async () => { throw new Error("database unavailable"); });
  const restoreDestroy = stub(cloudinary.uploader, "destroy", async (id: string) => { deleted.push(id); });
  try {
    const res = response();
    await createMobileBannerController({ body: validBody, file: { buffer: Buffer.from("image") } } as never, res as never);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(deleted, [newId]);
  } finally { restoreDestroy(); restoreCreate(); restoreUpload(); }
});
