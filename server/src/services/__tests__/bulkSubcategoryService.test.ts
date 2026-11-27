import assert from "node:assert/strict";
import test from "node:test";
import {
  BulkSubcategoryRequestError,
  MAX_BULK_SUBCATEGORIES,
  processBulkSubcategories,
  SUBCATEGORY_IMAGE_FOLDER,
  type BulkSubcategoryDependencies,
} from "../bulkSubcategoryService";
import type { SubcategoryInput } from "../categoryService";
import { isPublicImageAddress, parsePermittedImageUrl, isSupportedImageBuffer } from "../subcategoryImageSource";

const parentId = "64b000000000000000000001";
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const input = (name = "Fresh Fruit", image = "https://res.cloudinary.com/demo/image/upload/sample.png") => ({
  parentCategory: parentId,
  subcategories: [{ name, description: "  Fresh produce  ", image }],
});

const makeDependencies = (overrides: Partial<BulkSubcategoryDependencies> = {}) => {
  const calls = { validateImage: 0, download: 0, upload: 0, save: 0, delete: [] as string[] };
  const deps: BulkSubcategoryDependencies = {
    validateParent: async () => undefined,
    assertHierarchyReady: async () => undefined,
    listChildren: async () => [],
    listExactGlobalNames: async () => [],
    hasLegacyGlobalNameIndex: async () => false,
    validateImageSource: async () => { calls.validateImage += 1; },
    downloadImage: async () => { calls.download += 1; return png; },
    uploadImage: async (_buffer, _folder) => {
      calls.upload += 1;
      return { secure_url: "https://res.cloudinary.com/shop/image/upload/new.png", public_id: "quickcart/categories/subcategories/new" };
    },
    saveSubcategory: async (data) => {
      calls.save += 1;
      return { _id: `64b0000000000000000000${calls.save}`, name: data.name, image: data.image };
    },
    deleteImage: async (publicId) => { calls.delete.push(publicId); },
    ...overrides,
  };
  return { deps, calls };
};

test("creates valid entries with normalized names and the existing Cloudinary folder", async () => {
  let savedData: SubcategoryInput | undefined;
  const { deps, calls } = makeDependencies({
    saveSubcategory: async (data) => { savedData = data; return { _id: "new-id", name: data.name, image: data.image }; },
    uploadImage: async (_buffer, folder) => {
      assert.equal(folder, SUBCATEGORY_IMAGE_FOLDER);
      calls.upload += 1;
      return { secure_url: "https://res.cloudinary.com/shop/image/upload/new.png", public_id: "real-public-id" };
    },
  });
  const result = await processBulkSubcategories(input("  Fresh Fruit "), false, deps);
  assert.equal(result.summary.created, 1);
  assert.equal(savedData?.name, "Fresh Fruit");
  assert.equal(savedData?.description, "Fresh produce");
  assert.equal(savedData?.imagePublicId, "real-public-id");
  assert.equal(savedData?.isActive, true);
  assert.equal(result.results.created[0].id, "new-id");
});

test("rejects malformed and empty parent IDs before image work", async () => {
  const { deps, calls } = makeDependencies();
  await assert.rejects(processBulkSubcategories({ ...input(), parentCategory: "bad" }, false, deps), /valid MongoDB ObjectId/i);
  assert.equal(calls.validateImage, 0);
});

test("rejects missing or inactive parents before image work", async () => {
  for (const error of [new BulkSubcategoryRequestError("missing, inactive, or is a subcategory")]) {
    const { deps, calls } = makeDependencies({ validateParent: async () => { throw error; } });
    await assert.rejects(processBulkSubcategories(input(), false, deps), /inactive/i);
    assert.equal(calls.validateImage, 0);
  }
});

test("blocks writes until hierarchy migration readiness is verified", async () => {
  const { deps, calls } = makeDependencies({
    assertHierarchyReady: async () => { throw new BulkSubcategoryRequestError("Category hierarchy migration is required.", 503); },
  });
  await assert.rejects(processBulkSubcategories(input(), false, deps), (error: unknown) =>
    error instanceof BulkSubcategoryRequestError && error.statusCode === 503,
  );
  assert.equal(calls.download, 0);
  assert.equal(calls.upload, 0);
});

test("requires a non-empty array and enforces the batch maximum", async () => {
  const { deps } = makeDependencies();
  await assert.rejects(processBulkSubcategories({ parentCategory: parentId, subcategories: [] }, false, deps), /non-empty/i);
  const tooMany = Array.from({ length: MAX_BULK_SUBCATEGORIES + 1 }, (_, i) => ({ name: `Name ${i}`, image: "https://res.cloudinary.com/demo/image/upload/sample.png" }));
  await assert.rejects(processBulkSubcategories({ parentCategory: parentId, subcategories: tooMany }, false, deps), /maximum/i);
});

test("rejects unexpected fields, nested parent IDs, and invalid field types", async () => {
  const { deps } = makeDependencies();
  await assert.rejects(processBulkSubcategories({ ...input(), unexpected: true }, false, deps), /only parentCategory and subcategories/i);
  await assert.rejects(processBulkSubcategories({ parentCategory: parentId, subcategories: [{ name: "X", image: "x", parentCategory: parentId }] }, false, deps), /invalid fields/i);
  await assert.rejects(processBulkSubcategories({ parentCategory: parentId, subcategories: [{ name: 1, image: "x" }] }, false, deps), /string name and image/i);
});

test("skips duplicate names within a request without processing duplicate images", async () => {
  const body = { parentCategory: parentId, subcategories: [
    { name: "Fresh Fruit", image: "https://res.cloudinary.com/demo/image/upload/a.png" },
    { name: " Ｆresh Fruit ", image: "http://127.0.0.1/unsafe.png" },
  ] };
  const { deps, calls } = makeDependencies();
  const result = await processBulkSubcategories(body, false, deps);
  assert.equal(result.summary.created, 1);
  assert.equal(result.summary.skipped, 1);
  assert.equal(calls.download, 1);
  assert.equal(calls.upload, 1);
});

test("skips existing active or inactive subcategories before image work", async () => {
  const { deps, calls } = makeDependencies({ listChildren: async () => [{ name: "Fresh Fruit", normalizedName: "fresh fruit" }] });
  const result = await processBulkSubcategories(input(), false, deps);
  assert.equal(result.summary.skipped, 1);
  assert.equal(result.summary.created, 0);
  assert.equal(calls.validateImage, 0);
});

test("rejects unsafe URL syntax and hosts", () => {
  const allowed = new Set(["images.example.com"]);
  assert.throws(() => parsePermittedImageUrl("http://images.example.com/a.png", allowed), /HTTPS/i);
  assert.throws(() => parsePermittedImageUrl("https://127.0.0.1/a.png", allowed), /allowlist/i);
  assert.throws(() => parsePermittedImageUrl("https://evil.example/a.png", allowed), /allowlist/i);
  assert.throws(() => parsePermittedImageUrl("https://user:pass@images.example.com/a.png", allowed), /credentials/i);
  assert.equal(parsePermittedImageUrl("https://images.example.com/a.png", allowed).hostname, "images.example.com");
});

test("rejects private, loopback, link-local, and documentation DNS addresses", () => {
  for (const address of ["10.0.0.1", "127.0.0.1", "169.254.1.1", "192.168.1.2", "::1", "fc00::1", "fe80::1", "2001:db8::1"]) {
    assert.equal(isPublicImageAddress(address), false, `${address} must not be reachable as an image source`);
  }
  assert.equal(isPublicImageAddress("8.8.8.8"), true);
  assert.equal(isPublicImageAddress("2606:4700:4700::1111"), true);
});

test("rejects invalid image URL sources as an item failure", async () => {
  const { deps, calls } = makeDependencies({ validateImageSource: async () => { throw new Error("untrusted"); } });
  const result = await processBulkSubcategories(input(), false, deps);
  assert.equal(result.summary.failed, 1);
  assert.equal(calls.download, 0);
  assert.equal(calls.upload, 0);
});

test("supports only JPEG, PNG, and WEBP signatures", () => {
  assert.equal(isSupportedImageBuffer(png), true);
  assert.equal(isSupportedImageBuffer(Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(isSupportedImageBuffer(Buffer.from("RIFF0000WEBP")), true);
  assert.equal(isSupportedImageBuffer(Buffer.from("not an image")), false);
});

test("reports image download and Cloudinary upload failures independently", async () => {
  const download = makeDependencies({ downloadImage: async () => { throw new Error("network detail"); } });
  const downloadResult = await processBulkSubcategories(input(), false, download.deps);
  assert.equal(downloadResult.summary.failed, 1);
  assert.match(downloadResult.results.failed[0].reason, /failed/i);
  const upload = makeDependencies({ uploadImage: async () => { throw new Error("cloudinary detail"); } });
  const uploadResult = await processBulkSubcategories(input(), false, upload.deps);
  assert.equal(uploadResult.summary.failed, 1);
  assert.doesNotMatch(uploadResult.results.failed[0].reason, /cloudinary detail/i);
});

test("cleans up only the new Cloudinary asset after insertion failure", async () => {
  const { deps, calls } = makeDependencies({ saveSubcategory: async () => { throw new Error("database detail"); } });
  const result = await processBulkSubcategories(input(), false, deps);
  assert.equal(result.summary.failed, 1);
  assert.deepEqual(calls.delete, ["quickcart/categories/subcategories/new"]);
});

test("supports partial success with created, skipped, and failed outcomes", async () => {
  const body = { parentCategory: parentId, subcategories: [
    { name: "One", image: "https://res.cloudinary.com/demo/image/upload/one.png" },
    { name: "Existing", image: "https://res.cloudinary.com/demo/image/upload/existing.png" },
    { name: "Bad", image: "https://res.cloudinary.com/demo/image/upload/bad.png" },
  ] };
  const { deps } = makeDependencies({
    listChildren: async () => [{ name: "Existing", normalizedName: "existing" }],
    validateImageSource: async (url) => { if (url.endsWith("bad.png")) throw new Error("bad URL"); },
  });
  const result = await processBulkSubcategories(body, false, deps);
  assert.deepEqual(result.summary, { requested: 3, created: 1, skipped: 1, failed: 1 });
  assert.equal(result.success, true);
});

test("repeated requests skip existing names and do not download or upload again", async () => {
  const existing: Array<{ name: string; normalizedName: string }> = [];
  const { deps, calls } = makeDependencies({
    listChildren: async () => existing,
    saveSubcategory: async (data) => {
      existing.push({ name: data.name, normalizedName: data.name.normalize("NFKC").toLowerCase() });
      return { _id: "created-id", name: data.name, image: data.image };
    },
  });
  const first = await processBulkSubcategories(input(), false, deps);
  const second = await processBulkSubcategories(input(), false, deps);
  assert.equal(first.summary.created, 1);
  assert.equal(second.summary.skipped, 1);
  assert.equal(calls.upload, 1);
});

test("a concurrent duplicate-key race skips the loser and cleans only its uploaded asset", async () => {
  const existing = new Set<string>();
  let uploadNumber = 0;
  const removed: string[] = [];
  const { deps } = makeDependencies({
    uploadImage: async () => {
      uploadNumber += 1;
      return { secure_url: `https://res.cloudinary.com/shop/image/upload/${uploadNumber}.png`, public_id: `new-${uploadNumber}` };
    },
    saveSubcategory: async (data) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      const key = `${data.parentCategory}:${data.name.toLowerCase()}`;
      if (existing.has(key)) throw Object.assign(new Error("duplicate"), { statusCode: 409 });
      existing.add(key);
      return { _id: `new-${uploadNumber}`, name: data.name, image: data.image };
    },
    deleteImage: async (id) => { removed.push(id); },
  });
  const [left, right] = await Promise.all([
    processBulkSubcategories(input(), false, deps),
    processBulkSubcategories(input(), false, deps),
  ]);
  assert.equal(left.summary.created + right.summary.created, 1);
  assert.equal(left.summary.skipped + right.summary.skipped, 1);
  assert.equal(removed.length, 1);
  assert.ok(["new-1", "new-2"].includes(removed[0]));
});

test("dry-run validates sources but never downloads, uploads, saves, or deletes", async () => {
  const { deps, calls } = makeDependencies();
  const result = await processBulkSubcategories(input(), true, deps);
  assert.equal(result.results.proposed?.length, 1);
  assert.equal(calls.validateImage, 1);
  assert.equal(calls.download, 0);
  assert.equal(calls.upload, 0);
  assert.equal(calls.save, 0);
  assert.equal(calls.delete.length, 0);
});

test("reports a legacy global index conflict without trying to upload", async () => {
  const { deps, calls } = makeDependencies({
    hasLegacyGlobalNameIndex: async () => true,
    listExactGlobalNames: async () => [{ name: "Fresh Fruit", parentCategory: "64b000000000000000000002" }],
  });
  const result = await processBulkSubcategories(input(), false, deps);
  assert.equal(result.summary.failed, 1);
  assert.match(result.results.failed[0].reason, /legacy global unique name index/i);
  assert.equal(calls.download, 0);
  assert.equal(calls.upload, 0);
});
