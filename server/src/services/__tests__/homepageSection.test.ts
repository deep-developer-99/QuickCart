import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import Category from "../../models/Category";
import HomepageSection from "../../models/HomepageSection";
import Product from "../../models/Product";
import { getPublicHomepageSections, saveHomepageSections } from "../homepageSectionService";

const restoreMethod = (target: object, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(target, key, previous);
    else Reflect.deleteProperty(target, key);
  };
};

const subcategoryId = new Types.ObjectId("64b000000000000000000001");
const inactiveSubcategoryId = new Types.ObjectId("64b000000000000000000002");
const parentId = new Types.ObjectId("64b000000000000000000003");
const subcategory = (id: Types.ObjectId, name: string, isActive = true) => ({
  _id: id,
  name,
  image: `https://images.example/${name.toLowerCase()}.webp`,
  isActive,
  parentCategory: parentId,
});
const parent = { _id: parentId, name: "Pantry", isActive: true, parentCategory: null };
const queryResult = <T,>(value: T) => ({
  select() { return this; },
  sort() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean: async () => value,
});

test("homepage section schema caps product previews at fifteen", async () => {
  const section = new HomepageSection({ subCategory: subcategoryId, displayOrder: 0, productLimit: 16 });
  await assert.rejects(section.validate(), /Path `productLimit` \(16\) is more than maximum allowed value \(15\)/);
  assert.ok(HomepageSection.schema.indexes().some(([keys, options]) => keys.subCategory === 1 && options.unique === true));
});

test("rejects duplicate subcategories and product limits above fifteen before writing", async () => {
  let writes = 0;
  const restoreWrite = restoreMethod(HomepageSection, "bulkWrite", async () => { writes += 1; return {}; });
  try {
    await assert.rejects(saveHomepageSections([
      { subCategoryId: subcategoryId.toString(), isActive: true, productLimit: 10 },
      { subCategoryId: subcategoryId.toString(), isActive: false, productLimit: 10 },
    ]), /only be selected once/i);
    await assert.rejects(saveHomepageSections([
      { subCategoryId: subcategoryId.toString(), isActive: true, productLimit: 16 },
    ]), /between 1 and 15/i);
    assert.equal(writes, 0);
  } finally { restoreWrite(); }
});

test("an empty section configuration avoids category and product lookups", async () => {
  const restoreFind = restoreMethod(HomepageSection, "find", () => queryResult([]));
  const restoreProductFind = restoreMethod(Product, "find", async () => { throw new Error("No product query expected"); });
  const restoreCount = restoreMethod(Product, "countDocuments", async () => { throw new Error("No product query expected"); });
  try { assert.deepEqual(await getPublicHomepageSections(), []); }
  finally { restoreCount(); restoreProductFind(); restoreFind(); }
});

test("persists the submitted order and active state for valid child categories", async () => {
  const childDocs = [subcategory(subcategoryId, "Tea"), subcategory(inactiveSubcategoryId, "Coffee", false)];
  const savedRows: Array<{ _id: string; subCategory: Types.ObjectId; displayOrder: number; isActive: boolean; productLimit: number }> = [];
  let operations: Array<Record<string, unknown>> = [];
  const restoreCategoryFind = restoreMethod(Category, "find", (filter: Record<string, unknown>) => {
    if (filter.parentCategory === null) return queryResult([parent]);
    if (filter.isActive === true) return queryResult(childDocs.filter((item) => item.isActive));
    return queryResult(childDocs);
  });
  const restoreBulkWrite = restoreMethod(HomepageSection, "bulkWrite", async (ops: Array<Record<string, unknown>>) => {
    operations = ops;
    for (const op of ops) {
      const update = op.updateOne as { filter: { subCategory: Types.ObjectId }; update: { $set: { displayOrder: number; isActive: boolean; productLimit: number } } };
      const categoryId = update.filter.subCategory;
      savedRows.push({
        _id: categoryId.toString(),
        subCategory: categoryId,
        ...update.update.$set,
      });
    }
    return {};
  });
  const restoreDelete = restoreMethod(HomepageSection, "deleteMany", async () => ({ acknowledged: true }));
  const restoreSectionFind = restoreMethod(HomepageSection, "find", () => queryResult(savedRows));
  try {
    const result = await saveHomepageSections([
      { subCategoryId: inactiveSubcategoryId.toString(), isActive: false, productLimit: 8 },
      { subCategoryId: subcategoryId.toString(), isActive: true, productLimit: 15 },
    ]);
    const first = (operations[0].updateOne as { update: { $set: { displayOrder: number; isActive: boolean; productLimit: number } } }).update.$set;
    assert.deepEqual(first, { displayOrder: 0, isActive: false, productLimit: 8 });
    assert.equal(result.sections[0].subCategoryId, inactiveSubcategoryId.toString());
    assert.equal(result.sections[0].subCategory?.isActive, false);
    assert.equal(result.sections[1].displayOrder, 1);
  } finally {
    restoreSectionFind(); restoreDelete(); restoreBulkWrite(); restoreCategoryFind();
  }
});

test("public sections omit inactive categories, count eligible products, and cap each preview", async () => {
  const active = subcategory(subcategoryId, "Tea");
  const inactive = subcategory(inactiveSubcategoryId, "Coffee", false);
  const config = [
    { subCategory: subcategoryId, displayOrder: 0, isActive: true, productLimit: 15 },
    { subCategory: inactiveSubcategoryId, displayOrder: 1, isActive: true, productLimit: 15 },
  ];
  const productIds = Array.from({ length: 15 }, (_, index) => ({
    _id: new Types.ObjectId(),
    name: `Product ${index + 1}`,
    category: { _id: parentId, name: "Pantry" },
    subCategory: subcategoryId,
  }));
  const findFilters: Array<Record<string, unknown>> = [];
  const countFilters: Array<Record<string, unknown>> = [];
  const restoreSectionFind = restoreMethod(HomepageSection, "find", () => queryResult(config));
  const restoreCategoryFind = restoreMethod(Category, "find", (filter: Record<string, unknown>) => {
    if (filter.parentCategory === null) return queryResult([parent]);
    return queryResult([active, inactive]);
  });
  const restoreProductFind = restoreMethod(Product, "find", (filter: Record<string, unknown>) => {
    findFilters.push(filter);
    return queryResult(productIds);
  });
  const restoreCount = restoreMethod(Product, "countDocuments", async (filter: Record<string, unknown>) => {
    countFilters.push(filter);
    return 18;
  });
  try {
    const result = await getPublicHomepageSections();
    assert.equal(result.length, 1);
    assert.equal(result[0].subCategoryId, subcategoryId.toString());
    assert.equal(result[0].productCount, 18);
    assert.equal(result[0].products.length, 15);
    assert.equal(findFilters.length, 1);
    assert.equal(countFilters.length, 1);
    const match = findFilters[0] as { isActive: boolean; stock: { $gt: number }; subCategory: Types.ObjectId };
    assert.equal(match.isActive, true);
    assert.deepEqual(match.stock, { $gt: 0 });
    assert.equal(match.subCategory.toString(), subcategoryId.toString());
  } finally { restoreCount(); restoreProductFind(); restoreCategoryFind(); restoreSectionFind(); }
});

test("returns an active empty subcategory with a zero count and no preview products", async () => {
  const config = [{ subCategory: subcategoryId, displayOrder: 0, isActive: true, productLimit: 5 }];
  const restoreSectionFind = restoreMethod(HomepageSection, "find", () => queryResult(config));
  const restoreCategoryFind = restoreMethod(Category, "find", (filter: Record<string, unknown>) =>
    filter.parentCategory === null ? queryResult([parent]) : queryResult([subcategory(subcategoryId, "Tea")]),
  );
  const restoreProductFind = restoreMethod(Product, "find", () => queryResult([]));
  const restoreCount = restoreMethod(Product, "countDocuments", async () => 0);
  try {
    const result = await getPublicHomepageSections();
    assert.equal(result.length, 1);
    assert.equal(result[0].productCount, 0);
    assert.deepEqual(result[0].products, []);
  } finally { restoreCount(); restoreProductFind(); restoreCategoryFind(); restoreSectionFind(); }
});

test("keeps multiple configured sections independent and applies each preview limit", async () => {
  const secondSubcategoryId = new Types.ObjectId("64b000000000000000000004");
  const children = [subcategory(subcategoryId, "Tea"), subcategory(secondSubcategoryId, "Coffee")];
  const config = [
    { subCategory: subcategoryId, displayOrder: 0, isActive: true, productLimit: 5 },
    { subCategory: secondSubcategoryId, displayOrder: 1, isActive: true, productLimit: 15 },
  ];
  const requests: Array<{ id: string; limit: number }> = [];
  const restoreSectionFind = restoreMethod(HomepageSection, "find", () => queryResult(config));
  const restoreCategoryFind = restoreMethod(Category, "find", (filter: Record<string, unknown>) =>
    filter.parentCategory === null ? queryResult([parent]) : queryResult(children),
  );
  const restoreProductFind = restoreMethod(Product, "find", (filter: { subCategory: Types.ObjectId }) => {
    const id = filter.subCategory.toString();
    let limit = 0;
    return {
      sort() { return this; },
      limit(value: number) { limit = value; requests.push({ id, limit }); return this; },
      populate() { return this; },
      lean: async () => Array.from({ length: 20 }, (_, index) => ({ _id: `${id}-${index}` })).slice(0, limit),
    };
  });
  const restoreCount = restoreMethod(Product, "countDocuments", async () => 20);
  try {
    const result = await getPublicHomepageSections();
    assert.deepEqual(result.map((section) => section.productCount), [20, 20]);
    assert.deepEqual(result.map((section) => section.products.length), [5, 15]);
    assert.deepEqual(requests.map((request) => request.limit), [5, 15]);
  } finally { restoreCount(); restoreProductFind(); restoreCategoryFind(); restoreSectionFind(); }
});

test("ignores a configured section with an invalid subcategory reference", async () => {
  const restoreSectionFind = restoreMethod(HomepageSection, "find", () => queryResult([
    { subCategory: "not-an-object-id", displayOrder: 0, isActive: true, productLimit: 5 },
  ]));
  const restoreCategoryFind = restoreMethod(Category, "find", async () => { throw new Error("Invalid section must not query categories"); });
  try { assert.deepEqual(await getPublicHomepageSections(), []); }
  finally { restoreCategoryFind(); restoreSectionFind(); }
});

test("propagates database query failures for the controller to log and handle", async () => {
  const config = [{ subCategory: subcategoryId, displayOrder: 0, isActive: true, productLimit: 5 }];
  const restoreSectionFind = restoreMethod(HomepageSection, "find", () => queryResult(config));
  const restoreCategoryFind = restoreMethod(Category, "find", (filter: Record<string, unknown>) =>
    filter.parentCategory === null ? queryResult([parent]) : queryResult([subcategory(subcategoryId, "Tea")]),
  );
  const restoreProductFind = restoreMethod(Product, "find", () => queryResult([]));
  const restoreCount = restoreMethod(Product, "countDocuments", async () => { throw new Error("Database unavailable"); });
  try { await assert.rejects(getPublicHomepageSections(), /Database unavailable/); }
  finally { restoreCount(); restoreProductFind(); restoreCategoryFind(); restoreSectionFind(); }
});
