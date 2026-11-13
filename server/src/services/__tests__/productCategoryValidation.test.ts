import assert from "node:assert/strict";
import test from "node:test";

import Category from "../../models/Category";
import Product from "../../models/Product";
import { createProduct, updateProduct } from "../productService";

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
const main = (id = mainId, isActive = true) => ({ _id: id, isActive, parentCategory: null });
const child = (parentId = mainId, isActive = true) => ({ _id: subcategoryId, isActive, parentCategory: parentId });
const productData = { name: "Soda", description: "Can", image: "https://images.example/soda.webp", category: mainId, variants: [{ quantity: 1, unit: "pcs", price: 2, stock: 8 }] };

test("Product schema keeps subCategory optional and defaults it to null for existing products", () => {
  assert.equal(new Product().subCategory, null);
  assert.equal(Product.schema.path("subCategory")?.options.required, undefined);
});

test("Product variants validate unit, quantity, price, stock, and unique size-unit pairs", () => {
  const base = {
    name: "Milk", description: "Fresh milk", image: "https://images.example/milk.webp",
    category: new Product()._id, vendor: new Product()._id,
  };
  const valid = new Product({ ...base, variants: [
    { quantity: 500, unit: "ml", price: 30, stock: 50 },
    { quantity: 1, unit: "L", price: 55, stock: 30 },
  ] });
  assert.equal(valid.validateSync()?.errors?.variants, undefined);
  const duplicate = new Product({ ...base, variants: [
    { quantity: 500, unit: "ml", price: 30, stock: 50 },
    { quantity: 500, unit: "ml", price: 25, stock: 20 },
  ] });
  assert.match(duplicate.validateSync()?.errors?.variants?.message ?? "", /unique quantity and unit/i);
  const invalid = new Product({ ...base, variants: [{ quantity: -1, unit: "box", price: 0, stock: -1 }] });
  const invalidPaths = Object.keys(invalid.validateSync()?.errors ?? {});
  assert.ok(invalidPaths.some((path) => path.startsWith("variants.")));
});

test("creates a product with a valid matching main category and subcategory", async () => {
  let saved: Record<string, unknown> | undefined;
  const restoreFind = restoreMethod(Category, "findById", async (id: string) => id === mainId ? main() : child());
  const restoreCreate = restoreMethod(Product, "create", async (input: Record<string, unknown>) => { saved = input; return input; });
  try {
    await createProduct({ ...productData, subCategory: subcategoryId }, "vendor-id");
    assert.equal(saved?.category, mainId);
    assert.equal(saved?.subCategory, subcategoryId);
    assert.equal(saved?.vendor, "vendor-id");
  } finally {
    restoreFind();
    restoreCreate();
  }
});

test("allows products without a subcategory", async () => {
  let saved: Record<string, unknown> | undefined;
  const restoreFind = restoreMethod(Category, "findById", async () => main());
  const restoreCreate = restoreMethod(Product, "create", async (input: Record<string, unknown>) => { saved = input; return input; });
  try {
    await createProduct(productData, "vendor-id");
    assert.equal(saved?.subCategory, null);
  } finally {
    restoreFind();
    restoreCreate();
  }
});

test("rejects creating a product without a variant on the backend", async () => {
  const restoreFind = restoreMethod(Category, "findById", async () => main());
  const restoreCreate = restoreMethod(Product, "create", async () => { throw new Error("Product.create must not run"); });
  try {
    const { variants: _variants, ...legacyData } = productData;
    await assert.rejects(createProduct(legacyData as typeof productData, "vendor-id"), /at least one product variant/i);
  } finally {
    restoreFind();
    restoreCreate();
  }
});

test("rejects inactive main categories, subcategories, and mismatched parent pairs", async () => {
  for (const [category, subcategory, pattern] of [
    [main(mainId, false), child(), /active main category/i],
    [main(), child(mainId, false), /active subcategory/i],
    [main(), child(otherMainId), /does not belong/i],
    [{ _id: subcategoryId, isActive: true, parentCategory: mainId }, child(), /active main category/i],
  ] as const) {
    const restoreFind = restoreMethod(Category, "findById", async (id: string) => id === mainId ? category : subcategory);
    const restoreCreate = restoreMethod(Product, "create", async () => { throw new Error("Product.create must not run"); });
    try {
      await assert.rejects(createProduct({ ...productData, subCategory: subcategoryId }, "vendor-id"), pattern);
    } finally {
      restoreFind();
      restoreCreate();
    }
  }
});

test("requires explicit replacement or clearing when changing a product's main category", async () => {
  const product = {
    category: mainId,
    subCategory: subcategoryId,
    save: async () => product,
  };
  const restoreProductFind = restoreMethod(Product, "findOne", async () => product);
  const restoreCategoryFind = restoreMethod(Category, "findById", async (id: string) => {
    if (id === otherMainId) return main(otherMainId);
    return child(mainId);
  });
  try {
    await assert.rejects(updateProduct("product-id", "vendor-id", { category: otherMainId }), /does not belong/i);
    const updated = await updateProduct("product-id", "vendor-id", { category: otherMainId, subCategory: null });
    assert.equal((updated as typeof product).category, otherMainId);
    assert.equal((updated as typeof product).subCategory, null);
  } finally {
    restoreProductFind();
    restoreCategoryFind();
  }
});
