import assert from "node:assert/strict";
import test from "node:test";
import {
  activeSubcategoriesForParent,
  getDefaultSubcategoryId,
} from "../categorySelection.ts";

test("filters inactive and stale subcategories out of a vendor selection", () => {
  const categories = [
    { _id: "s1", parentCategory: "main-1", isActive: true },
    { _id: "s2", parentCategory: "main-2", isActive: true },
    { _id: "s3", parentCategory: { _id: "main-1" }, isActive: false },
  ];

  assert.deepEqual(activeSubcategoriesForParent(categories, "main-1"), [categories[0]]);
});

test("selects the first active subcategory by default and safely handles an empty list", () => {
  assert.equal(getDefaultSubcategoryId([
    { _id: "inactive", isActive: false },
    { _id: "first-active", isActive: true },
    { _id: "second-active", isActive: true },
  ]), "first-active");
  assert.equal(getDefaultSubcategoryId([]), "");
});
