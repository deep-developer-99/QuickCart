import assert from "node:assert/strict";
import test from "node:test";

import Category from "../../models/Category";
import Product from "../../models/Product";
import {
  createSubcategory,
  deleteSubcategory,
  updateSubcategory,
} from "../categoryService";

const restoreMethod = (target: object, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(target, key, previous);
    else Reflect.deleteProperty(target, key);
  };
};

const mainId = "64b000000000000000000001";
const otherMainId = "64b000000000000000000002";
const subcategoryId = "64b000000000000000000003";
const parent = (id = mainId, isActive = true) => ({ _id: id, isActive, parentCategory: null });

test("Category schema keeps names scoped to hierarchy and normalizes names on save", async () => {
  const main = new Category({ name: "  Drinks & Juices  " });
  await main.validate();
  assert.equal(main.name, "Drinks & Juices");
  assert.equal(main.normalizedName, "drinks & juices");
  assert.equal(main.parentCategory, null);
  assert.ok(Category.schema.indexes().some(([keys, options]) =>
    keys.parentCategory === 1 && keys.normalizedName === 1 && options.unique === true,
  ));
  assert.equal(Category.schema.path("name")?.options.unique, undefined);
});

test("creates an image-backed subcategory under an active main category", async () => {
  let saved: Record<string, unknown> | undefined;
  const restoreFind = restoreMethod(Category, "findOne", async (filter: Record<string, unknown>) =>
    filter.parentCategory === null ? parent() : null,
  );
  const restoreCreate = restoreMethod(Category, "create", async (input: Record<string, unknown>) => {
    saved = input;
    return input;
  });
  try {
    const result = await createSubcategory({
      name: "  Soft Drinks ", parentCategory: mainId,
      image: "https://images.example/subcategory.webp", imagePublicId: "quickcart/subcategories/soft-drinks",
    });
    assert.equal((result as { name: string }).name, "Soft Drinks");
    assert.equal(saved?.normalizedName, "soft drinks");
    assert.equal(saved?.parentCategory, mainId);
    assert.equal(saved?.imagePublicId, "quickcart/subcategories/soft-drinks");
  } finally {
    restoreFind();
    restoreCreate();
  }
});

test("rejects a subcategory without a completed image upload", async () => {
  await assert.rejects(
    createSubcategory({ name: "Soft Drinks", parentCategory: mainId }),
    /successfully uploaded subcategory image is required/i,
  );
});

test("rejects missing, inactive, and nested parents", async () => {
  await assert.rejects(createSubcategory({
    name: "Child", parentCategory: "", image: "https://images.example/a.webp", imagePublicId: "a",
  }), /valid main category/i);

  for (const selectedParent of [null, { _id: mainId, isActive: false, parentCategory: null }, { _id: mainId, isActive: true, parentCategory: otherMainId }]) {
    const restoreFind = restoreMethod(Category, "findOne", async (filter: Record<string, unknown>) => {
      assert.equal(filter.parentCategory, null);
      assert.equal(filter.isActive, true);
      return selectedParent?.isActive && selectedParent.parentCategory == null ? selectedParent : null;
    });
    const restoreCreate = restoreMethod(Category, "create", async () => { throw new Error("create must not run"); });
    try {
      await assert.rejects(createSubcategory({
        name: "Child", parentCategory: mainId, image: "https://images.example/a.webp", imagePublicId: "a",
      }), /missing, inactive, or is a subcategory/i);
    } finally {
      restoreFind();
      restoreCreate();
    }
  }
});

test("normalizes duplicates within one parent while allowing the same name under another parent", async () => {
  let currentParent = mainId;
  let normalizedQuery = "";
  let createCount = 0;
  const restoreFind = restoreMethod(Category, "findOne", async (filter: Record<string, unknown>) => {
    if (filter.parentCategory === null) return parent(currentParent);
    if (filter.normalizedName === "soft drinks") {
      normalizedQuery = String(filter.normalizedName);
      return filter.parentCategory === mainId ? { _id: subcategoryId } : null;
    }
    return null;
  });
  const restoreCreate = restoreMethod(Category, "create", async () => { createCount += 1; return { _id: `created-${createCount}` }; });
  try {
    await assert.rejects(createSubcategory({
      name: " SOFT DRINKS ", parentCategory: mainId, image: "https://images.example/a.webp", imagePublicId: "a",
    }), /already exists under that main category/i);

    currentParent = otherMainId;
    const result = await createSubcategory({
      name: "Soft Drinks", parentCategory: currentParent, image: "https://images.example/b.webp", imagePublicId: "b",
    });
    assert.ok(result);
    assert.equal(normalizedQuery, "soft drinks");
    assert.equal(createCount, 1);
  } finally {
    restoreFind();
    restoreCreate();
  }
});

test("editing keeps a valid image when no replacement is uploaded and updates the normalized name", async () => {
  const doc = {
    _id: subcategoryId,
    name: "Old name",
    normalizedName: "old name",
    parentCategory: mainId,
    image: "https://images.example/existing.webp",
    imagePublicId: "existing-id",
    isActive: true,
    save: async () => doc,
  };
  let findCount = 0;
  const restoreFind = restoreMethod(Category, "findOne", async (filter: Record<string, unknown>) => {
    findCount += 1;
    if (filter._id === subcategoryId) return doc;
    if (filter._id === mainId) return parent();
    return null;
  });
  const restoreCount = restoreMethod(Product, "countDocuments", async () => 0);
  try {
    const result = await updateSubcategory(subcategoryId, { name: "  New Name ", parentCategory: mainId });
    assert.equal((result as typeof doc).name, "New Name");
    assert.equal((result as typeof doc).normalizedName, "new name");
    assert.equal((result as typeof doc).imagePublicId, "existing-id");
    assert.equal(findCount, 3);
  } finally {
    restoreFind();
    restoreCount();
  }
});

test("blocks deletion when any product, including inactive products, references a subcategory", async () => {
  const doc = { _id: subcategoryId, isActive: true };
  const restoreFind = restoreMethod(Category, "findOne", async () => doc);
  let productFilter: unknown;
  const restoreCount = restoreMethod(Product, "countDocuments", async (filter: unknown) => { productFilter = filter; return 4; });
  try {
    await assert.rejects(deleteSubcategory(subcategoryId), (error: unknown) => {
      assert.match((error as Error).message, /4 products are assigned/i);
      assert.equal((error as { statusCode: number }).statusCode, 409);
      assert.equal((error as { productsCount: number }).productsCount, 4);
      return true;
    });
    assert.deepEqual(productFilter, { subCategory: subcategoryId });
  } finally {
    restoreFind();
    restoreCount();
  }
});
