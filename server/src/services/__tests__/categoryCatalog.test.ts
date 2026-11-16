import assert from "node:assert/strict";
import test from "node:test";

import Category from "../../models/Category";
import { getCategoryCatalog } from "../categoryService";

const restoreMethod = (target: object, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(target, key, previous);
    else Reflect.deleteProperty(target, key);
  };
};

test("category catalog groups active subcategories under active parents in display order", async () => {
  const parents = [
    { _id: "parent-a", name: "Bath & Body", parentCategory: null },
    { _id: "parent-b", name: "Hair", parentCategory: null },
  ];
  const subcategories = [
    { _id: "child-a", name: "Shower Gel", parentCategory: "parent-a" },
    { _id: "child-b", name: "Shampoo", parentCategory: "parent-b" },
    { _id: "orphan", name: "Unmatched", parentCategory: "missing-parent" },
  ];
  const filters: Record<string, unknown>[] = [];
  const sortOrders: Record<string, number>[] = [];
  const restoreFind = restoreMethod(Category, "find", (filter: Record<string, unknown>) => {
    filters.push(filter);
    return {
      sort: (order: Record<string, number>) => {
        sortOrders.push(order);
        return {
          lean: async () => filter.parentCategory === null ? parents : subcategories,
        };
      },
    };
  });

  try {
    const catalog = await getCategoryCatalog();
    assert.deepEqual(catalog.map(({ name, subcategories: children }) => ({
      name,
      subcategories: children.map((child: { name: string }) => child.name),
    })), [
      { name: "Bath & Body", subcategories: ["Shower Gel"] },
      { name: "Hair", subcategories: ["Shampoo"] },
    ]);
    assert.deepEqual(filters, [
      { isActive: true, parentCategory: null },
      { isActive: true, parentCategory: { $ne: null } },
    ]);
    assert.deepEqual(sortOrders, [{ name: 1 }, { name: 1 }]);
  } finally {
    restoreFind();
  }
});
