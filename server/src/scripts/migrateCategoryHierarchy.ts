import "dotenv/config";

import mongoose, { Types } from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";

type LegacyCategoryRow = {
  _id: Types.ObjectId;
  name: string;
  parentCategory?: Types.ObjectId | null;
};

const INDEX_NAME = "category_parent_normalized_name_unique";
const INDEX_KEY = { parentCategory: 1, normalizedName: 1 };
const normalizeName = (name: string) => name.trim().normalize("NFKC").toLocaleLowerCase("en");
const sameKey = (actual: Record<string, unknown> | undefined, expected: Record<string, number>) =>
  JSON.stringify(Object.entries(actual || {}).sort(([a], [b]) => a.localeCompare(b))) ===
  JSON.stringify(Object.entries(expected).sort(([a], [b]) => a.localeCompare(b)));

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);

  const categories = await Category.collection
    .find({}, { projection: { _id: 1, name: 1, parentCategory: 1 } })
    .toArray() as LegacyCategoryRow[];

  const categoryById = new Map(categories.map((category) => [category._id.toString(), category]));
  for (const category of categories) {
    const parentId = category.parentCategory?.toString();
    if (!parentId) continue;
    const parent = categoryById.get(parentId);
    if (!parent || parent.parentCategory != null) {
      throw new Error(`Category ${category._id} has an invalid parent. Resolve hierarchy conflicts before migration.`);
    }
  }

  const seen = new Map<string, string>();
  for (const category of categories) {
    const parent = category.parentCategory?.toString() || "main";
    const normalizedName = normalizeName(category.name);
    const key = `${parent}:${normalizedName}`;
    const existingId = seen.get(key);
    if (existingId) {
      throw new Error(
        `Duplicate category names block the migration: ${category.name} (${existingId}, ${category._id}). Resolve this conflict before retrying.`,
      );
    }
    seen.set(key, category._id.toString());
  }

  const existingIndexes = await Category.collection.indexes();
  const legacyUniqueNameIndexes = existingIndexes.filter(
    (index) => sameKey(index.key as Record<string, unknown>, { name: 1 }) && index.unique === true,
  );
  const unexpectedUniqueNameIndexes = existingIndexes.filter((index) =>
    index.unique === true && Object.hasOwn(index.key || {}, "name") &&
    !sameKey(index.key as Record<string, unknown>, { name: 1 }),
  );
  if (unexpectedUniqueNameIndexes.length) {
    throw new Error("An unrecognized unique index includes the name field. Inspect indexes manually; no index was dropped.");
  }
  if (legacyUniqueNameIndexes.length > 1) {
    throw new Error("Multiple unique name indexes exist. Inspect indexes manually; no index was dropped.");
  }
  if (legacyUniqueNameIndexes.some((index) => index.sparse || index.partialFilterExpression || index.collation)) {
    throw new Error("The legacy unique name index has custom options. Inspect it manually; no index was dropped.");
  }

  const sameCompoundIndexes = existingIndexes.filter((index) => sameKey(index.key as Record<string, unknown>, INDEX_KEY));
  if (sameCompoundIndexes.some((index) => index.name !== INDEX_NAME || (index.unique !== true && index.unique !== false))) {
    throw new Error("An unexpected index already uses the hierarchy key. Inspect indexes manually; no index was dropped.");
  }
  if (sameCompoundIndexes.some((index) => index.sparse || index.partialFilterExpression || index.collation)) {
    throw new Error("The hierarchy index has custom options. Inspect it manually; no index was dropped.");
  }
  if (sameCompoundIndexes.some((index) => index.name === INDEX_NAME && index.unique === false)) {
    await Category.collection.dropIndex(INDEX_NAME);
  }

  if (categories.length) {
    const updates = categories.map((category) => ({
      updateOne: {
        filter: { _id: category._id },
        update: {
          $set: {
            parentCategory: category.parentCategory ?? null,
            normalizedName: normalizeName(category.name),
          },
        },
      },
    }));
    await Category.collection.bulkWrite(updates);
  }

  const refreshedIndexes = await Category.collection.indexes();
  const hierarchyIndex = refreshedIndexes.find((index) => index.name === INDEX_NAME);
  if (!hierarchyIndex) {
    await Category.collection.createIndex(INDEX_KEY, { unique: true, name: INDEX_NAME });
  } else if (!sameKey(hierarchyIndex.key as Record<string, unknown>, INDEX_KEY) || hierarchyIndex.unique !== true) {
    throw new Error(`Index ${INDEX_NAME} exists with an unexpected definition. It was not changed.`);
  }

  const legacyNameIndex = legacyUniqueNameIndexes[0];
  if (legacyNameIndex?.name) {
    const stillPresent = (await Category.collection.indexes()).some((index) => index.name === legacyNameIndex.name);
    if (stillPresent) await Category.collection.dropIndex(legacyNameIndex.name);
  }

  const productBackfill = await Product.collection.updateMany(
    { subCategory: { $exists: false } },
    { $set: { subCategory: null } },
  );

  console.log(`Category hierarchy migration complete. ${categories.length} existing categories remain main categories.`);
  console.log(`Existing products kept their main category; ${productBackfill.modifiedCount} received subCategory: null.`);
  console.log(`Verified unique index: ${INDEX_NAME}; removed legacy global name index only after the scoped index was ready.`);
};

run()
  .catch((error) => {
    console.error("Category hierarchy migration stopped safely:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
