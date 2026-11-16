import assert from 'node:assert/strict';
import test from 'node:test';

import Category from '../../models/Category';
import Product from '../../models/Product';
import { getAllProducts } from '../productService';

const restoreMethod = (target: object, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(target, key, previous);
    else Reflect.deleteProperty(target, key);
  };
};

const categoryId = '64b000000000000000000001';
const product = (id: string) => ({ _id: id, name: id, variants: [] });

const installCategoryFind = () => restoreMethod(Category, 'findById', async (id: string) =>
  id === categoryId ? { _id: categoryId, isActive: true, parentCategory: null } : null,
);

const queryFor = (rows: unknown[], capture: (key: string, value: unknown) => void) => {
  const query: any = Promise.resolve(rows);
  query.select = () => query;
  query.populate = () => query;
  query.sort = (value: unknown) => { capture('sort', value); return query; };
  query.skip = (value: unknown) => { capture('skip', value); return query; };
  query.limit = (value: unknown) => { capture('limit', value); return query; };
  return query;
};

test('product browsing applies paginated alphabetic sorting with a stable ID tie-breaker', async () => {
  const captured: Record<string, unknown> = {};
  const restoreCategory = installCategoryFind();
  const restoreFind = restoreMethod(Product, 'find', () => queryFor([product('one')], (key, value) => { captured[key] = value; }));
  const restoreCount = restoreMethod(Product, 'countDocuments', async () => 35);
  try {
    const result = await getAllProducts(undefined, categoryId, 2, 15, undefined, 'az');
    assert.deepEqual(captured.sort, { name: 1, _id: 1 });
    assert.equal(captured.skip, 15);
    assert.equal(captured.limit, 15);
    assert.equal(result.pagination.hasNextPage, true);
  } finally {
    restoreFind();
    restoreCount();
    restoreCategory();
  }
});

test('price sorting computes variant sale prices and applies a deterministic ID tie-breaker', async () => {
  let pipeline: any[] = [];
  let findFilter: any;
  const ids = [new Product()._id, new Product()._id];
  const restoreCategory = installCategoryFind();
  const restoreAggregate = restoreMethod(Product, 'aggregate', async (value: any[]) => { pipeline = value; return ids.map(_id => ({ _id })); });
  const restoreFind = restoreMethod(Product, 'find', (filter: unknown) => {
    findFilter = filter;
    return queryFor(ids.map(id => product(id.toString())), () => undefined);
  });
  const restoreCount = restoreMethod(Product, 'countDocuments', async () => 2);
  try {
    const result = await getAllProducts(undefined, categoryId, 1, 15, undefined, 'priceLow');
    assert.deepEqual((pipeline.find(stage => stage.$sort) as any).$sort, { _sortSellingPrice: 1, _id: 1 });
    assert.ok((pipeline.find(stage => stage.$addFields) as any).$addFields._sortSellingPrice.$min.$map);
    assert.deepEqual(findFilter, { _id: { $in: ids } });
    assert.equal(result.data.length, 2);
  } finally {
    restoreAggregate();
    restoreFind();
    restoreCount();
    restoreCategory();
  }
});
