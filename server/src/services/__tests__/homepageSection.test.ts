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
  const restoreAggregate = restoreMethod(Product, "aggregate", async () => { throw new Error("No product query expected"); });
  try { assert.deepEqual(await getPublicHomepageSections(), []); }
  finally { restoreAggregate(); restoreFind(); }
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

test("public sections omit inactive categories, count all eligible products, and cap previews", async () => {
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
  const aggregatePipelines: unknown[][] = [];
  const restoreSectionFind = restoreMethod(HomepageSection, "find", () => queryResult(config));
  const restoreCategoryFind = restoreMethod(Category, "find", (filter: Record<string, unknown>) => {
    if (filter.parentCategory === null) return queryResult([parent]);
    return queryResult([active, inactive]);
  });
  const restoreAggregate = restoreMethod(Product, "aggregate", async (pipeline: unknown[]) => {
    aggregatePipelines.push(pipeline);
    return pipeline.some((stage) => "$group" in (stage as object))
      ? [{ _id: subcategoryId, productCount: 18 }]
      : productIds;
  });
  try {
    const result = await getPublicHomepageSections();
    assert.equal(result.length, 1);
    assert.equal(result[0].subCategoryId, subcategoryId.toString());
    assert.equal(result[0].productCount, 18);
    assert.equal(result[0].products.length, 15);
    assert.equal(aggregatePipelines.length, 2);
    const match = (aggregatePipelines[0][0] as { $match: { isActive: boolean; stock: { $gt: number } } }).$match;
    assert.equal(match.isActive, true);
    assert.deepEqual(match.stock, { $gt: 0 });
  } finally { restoreAggregate(); restoreCategoryFind(); restoreSectionFind(); }
});

test("returns an active empty subcategory with a zero count and no preview products", async () => {
  const config = [{ subCategory: subcategoryId, displayOrder: 0, isActive: true, productLimit: 5 }];
  const restoreSectionFind = restoreMethod(HomepageSection, "find", () => queryResult(config));
  const restoreCategoryFind = restoreMethod(Category, "find", (filter: Record<string, unknown>) =>
    filter.parentCategory === null ? queryResult([parent]) : queryResult([subcategory(subcategoryId, "Tea")]),
  );
  const restoreAggregate = restoreMethod(Product, "aggregate", async () => []);
  try {
    const result = await getPublicHomepageSections();
    assert.equal(result.length, 1);
    assert.equal(result[0].productCount, 0);
    assert.deepEqual(result[0].products, []);
  } finally { restoreAggregate(); restoreCategoryFind(); restoreSectionFind(); }
});
