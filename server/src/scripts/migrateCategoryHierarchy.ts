import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose, { Types } from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";

type CategoryRow = {
  _id: Types.ObjectId;
  name: string;
  parentCategory?: Types.ObjectId | null;
  normalizedName?: string;
  image?: string;
  imagePublicId?: string;
  isActive?: boolean;
};

type ProductRow = {
  _id: Types.ObjectId;
  category?: Types.ObjectId;
  subCategory?: Types.ObjectId | null;
  image?: string;
  imagePublicId?: string;
};

const INDEX_NAME = "category_parent_normalized_name_unique";
const INDEX_KEY = { parentCategory: 1, normalizedName: 1 };
const PLAN_PATH = path.resolve(process.env.CATEGORY_HIERARCHY_MIGRATION_PLAN || "tmp/category-hierarchy-migration-plan.json");
const normalizeName = (name: string) => name.trim().normalize("NFKC").toLocaleLowerCase("en");
const sameKey = (actual: Record<string, unknown> | undefined, expected: Record<string, number>) =>
  JSON.stringify(Object.entries(actual || {}).sort(([a], [b]) => a.localeCompare(b))) ===
  JSON.stringify(Object.entries(expected).sort(([a], [b]) => a.localeCompare(b)));
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const mediaFingerprint = (row: { image?: string; imagePublicId?: string }) =>
  createHash("sha256").update(`${row.image || ""}\0${row.imagePublicId || ""}`).digest("hex");

const getTarget = () => ({ host: mongoose.connection.host, database: mongoose.connection.name });

const run = async () => {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = args.length === 0 || args.includes("--dry-run");
  if (apply === dryRun) throw new Error("Choose exactly one mode: --dry-run or --apply.");
  const approvedHash = args.find((arg) => arg.startsWith("--approve="))?.slice("--approve=".length);
  if (apply && !approvedHash) throw new Error("Apply requires --approve=<reviewed-dry-run-hash>.");
  if (apply && !args.includes("--backup-verified")) {
    throw new Error("Apply requires --backup-verified after confirming a current, recoverable backup and a successful restore test.");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });

  const categories = await Category.collection
    .find({}, { projection: { _id: 1, name: 1, parentCategory: 1, normalizedName: 1, image: 1, imagePublicId: 1, isActive: 1 } })
    .toArray() as CategoryRow[];
  const products = await Product.collection
    .find({}, { projection: { _id: 1, category: 1, subCategory: 1, image: 1, imagePublicId: 1 } })
    .toArray() as ProductRow[];

  const categoryById = new Map(categories.map((category) => [category._id.toString(), category]));
  const parentIssues: string[] = [];
  for (const category of categories) {
    const parentId = category.parentCategory?.toString();
    if (!parentId) continue;
    const parent = categoryById.get(parentId);
    if (!parent || parent.parentCategory != null) {
      parentIssues.push(`${category.name} (${category._id}) has an invalid or nested parent (${parentId}).`);
    }
  }
  if (parentIssues.length) throw new Error(`Invalid parent references block migration: ${parentIssues.join(" ")}`);

  const seen = new Map<string, CategoryRow>();
  for (const category of categories) {
    const parent = category.parentCategory?.toString() || "main";
    const normalizedName = normalizeName(category.name);
    const key = `${parent}:${normalizedName}`;
    const existing = seen.get(key);
    if (existing) {
      throw new Error(`Duplicate normalized category names block migration: ${existing.name} (${existing._id}) and ${category.name} (${category._id}).`);
    }
    seen.set(key, category);
  }

  const indexes = await Category.collection.indexes();
  const legacyUniqueNameIndexes = indexes.filter(
    (index) => sameKey(index.key as Record<string, unknown>, { name: 1 }) && index.unique === true,
  );
  const unexpectedUniqueNameIndexes = indexes.filter((index) =>
    index.unique === true && Object.hasOwn(index.key || {}, "name") &&
    !sameKey(index.key as Record<string, unknown>, { name: 1 }),
  );
  if (unexpectedUniqueNameIndexes.length) {
    throw new Error("An unrecognized unique index includes the name field. Inspect indexes manually; no index was changed.");
  }
  if (legacyUniqueNameIndexes.length > 1) throw new Error("Multiple unique name indexes exist. Inspect indexes manually; no index was changed.");
  if (legacyUniqueNameIndexes.some((index) => index.sparse || index.partialFilterExpression || index.collation)) {
    throw new Error("The legacy unique name index has custom options. Inspect it manually; no index was changed.");
  }

  const compoundIndexes = indexes.filter((index) => sameKey(index.key as Record<string, unknown>, INDEX_KEY));
  if (compoundIndexes.some((index) => index.name !== INDEX_NAME)) {
    throw new Error("An unexpected index already uses the hierarchy key. Inspect indexes manually; no index was changed.");
  }
  if (compoundIndexes.some((index) => index.sparse || index.partialFilterExpression || index.collation)) {
    throw new Error("The hierarchy index has custom options. Inspect indexes manually; no index was changed.");
  }
  const namedCompound = compoundIndexes.find((index) => index.name === INDEX_NAME);

  const categoryChanges = categories.flatMap((category) => {
    const nextParent = category.parentCategory ?? null;
    const nextNormalizedName = normalizeName(category.name);
    const setParent = !Object.hasOwn(category, "parentCategory");
    const setNormalizedName = category.normalizedName !== nextNormalizedName;
    if (!setParent && !setNormalizedName) return [];
    return [{
      id: category._id.toString(),
      name: category.name,
      currentParentCategory: category.parentCategory?.toString() ?? (Object.hasOwn(category, "parentCategory") ? null : "<missing>"),
      nextParentCategory: nextParent?.toString() ?? null,
      currentNormalizedName: category.normalizedName ?? null,
      nextNormalizedName,
      setParentCategory: setParent,
      setNormalizedName,
      mediaFingerprint: mediaFingerprint(category),
    }];
  });
  const productsMissingSubcategory = products.filter((product) => !Object.hasOwn(product, "subCategory"));
  const productIds = new Set(products.map((product) => product._id.toString()));
  if (productIds.size !== products.length) throw new Error("Product ID snapshot contains duplicates; stop and inspect manually.");

  const mainIds = new Set(categories.filter((category) => category.parentCategory == null).map((category) => category._id.toString()));
  const referenceIssues: string[] = [];
  for (const product of products) {
    const main = product.category ? categoryById.get(product.category.toString()) : undefined;
    if (!main || !mainIds.has(main._id.toString())) referenceIssues.push(`Product ${product._id} has a missing or non-main category reference.`);
    if (product.subCategory != null) {
      const child = categoryById.get(product.subCategory.toString());
      if (!child || child.parentCategory?.toString() !== product.category?.toString()) {
        referenceIssues.push(`Product ${product._id} has a missing or mismatched subcategory reference.`);
      }
    }
  }
  if (referenceIssues.length) throw new Error(`Product category references block migration: ${referenceIssues.join(" ")}`);

  const replaceNonUniqueCompound = Boolean(namedCompound && namedCompound.unique !== true);
  const indexChanges = [
    ...(replaceNonUniqueCompound ? [{ action: "drop-before-create", name: INDEX_NAME, key: INDEX_KEY, unique: false }] : []),
    ...(!namedCompound || replaceNonUniqueCompound ? [{ action: "create", name: INDEX_NAME, key: INDEX_KEY, unique: true }] : []),
    ...(legacyUniqueNameIndexes[0]?.name ? [{ action: "drop-after-compound-created", name: legacyUniqueNameIndexes[0].name, key: { name: 1 }, unique: true }] : []),
  ];
  const migrationPlan = {
    target: getTarget(),
    counts: {
      categories: categories.length,
      mainCategories: categories.filter((category) => category.parentCategory == null).length,
      subcategories: categories.filter((category) => category.parentCategory != null).length,
      products: products.length,
      categoryDocumentsChanged: categoryChanges.length,
      productDocumentsChanged: productsMissingSubcategory.length,
    },
    categoryInventory: categories.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      parentCategory: category.parentCategory?.toString() ?? null,
      normalizedName: category.normalizedName ?? null,
      isActive: category.isActive ?? null,
      mediaFingerprint: mediaFingerprint(category),
    })),
    productInventory: products.map((product) => ({
      id: product._id.toString(),
      categoryId: product.category?.toString() ?? null,
      subCategoryId: product.subCategory?.toString() ?? null,
      mediaFingerprint: mediaFingerprint(product),
    })),
    categoryChanges,
    productsMissingSubcategory: productsMissingSubcategory.map((product) => ({
      id: product._id.toString(),
      categoryId: product.category?.toString() ?? null,
      currentSubCategory: "<missing>",
      nextSubCategory: null,
      imageFingerprint: mediaFingerprint(product),
    })),
    productsWithExistingSubcategory: products.filter((product) => product.subCategory != null).map((product) => ({
      id: product._id.toString(),
      categoryId: product.category?.toString() ?? null,
      subCategoryId: product.subCategory?.toString() ?? null,
      imageFingerprint: mediaFingerprint(product),
    })),
    indexesBefore: indexes.map((index) => ({
      name: index.name,
      key: index.key,
      unique: index.unique === true,
      sparse: index.sparse === true,
      partialFilterExpression: index.partialFilterExpression ?? null,
      collation: index.collation ?? null,
    })),
    indexChanges,
    invariants: {
      duplicateNormalizedNames: 0,
      invalidParentReferences: 0,
      invalidProductReferences: 0,
      categoryIdsCreatedOrDeleted: 0,
      productIdsCreatedOrDeleted: 0,
      categoryImagesOrPublicIdsChanged: 0,
      productImagesOrPublicIdsChanged: 0,
      productCategoryReferencesChanged: 0,
    },
  };
  const approvalHash = fingerprint(migrationPlan);
  const planFile = { ...migrationPlan, approvalHash };

  if (dryRun) {
    await mkdir(path.dirname(PLAN_PATH), { recursive: true });
    await writeFile(PLAN_PATH, `${JSON.stringify(planFile, null, 2)}\n`, "utf8");
    console.log(`Connected read-only to ${migrationPlan.target.database} on ${migrationPlan.target.host}.`);
    console.log("Migration mode: DRY RUN; no database writes were performed.");
    console.log(`Categories: ${migrationPlan.counts.categories} (${migrationPlan.counts.mainCategories} main, ${migrationPlan.counts.subcategories} subcategories).`);
    console.log(`Category documents requiring field updates: ${migrationPlan.counts.categoryDocumentsChanged}.`);
    console.log(`Products: ${migrationPlan.counts.products}; missing subCategory to set null: ${migrationPlan.counts.productDocumentsChanged}.`);
    console.log("Category updates:");
    for (const change of categoryChanges) {
      console.log(`  ${change.id} ${change.name}: parentCategory ${change.currentParentCategory} → ${change.nextParentCategory}; normalizedName ${change.currentNormalizedName ?? "<missing>"} → ${change.nextNormalizedName}.`);
    }
    console.log("Product updates:");
    for (const product of migrationPlan.productsMissingSubcategory) console.log(`  ${product.id}: subCategory <missing> → null (category ${product.categoryId}).`);
    console.log("Index changes:");
    for (const change of indexChanges) console.log(`  ${change.action}: ${change.name} ${JSON.stringify(change.key)}${change.unique ? " unique" : ""}.`);
    console.log(`Read-only report saved to ${PLAN_PATH}`);
    console.log(`Approval hash: ${approvalHash}`);
    return;
  }

  if (approvedHash !== approvalHash) throw new Error("The current database plan does not match --approve. Re-run dry-run and review the new report.");

  if (replaceNonUniqueCompound) {
    await Category.collection.dropIndex(INDEX_NAME);
  }
  if (categoryChanges.length) {
    await Category.collection.bulkWrite(categoryChanges.map((change) => {
      const current = categories.find((category) => category._id.toString() === change.id)!;
      const set: Record<string, unknown> = {};
      if (change.setParentCategory) set.parentCategory = current.parentCategory ?? null;
      if (change.setNormalizedName) set.normalizedName = change.nextNormalizedName;
      return { updateOne: { filter: { _id: current._id }, update: { $set: set } } };
    }));
  }

  const refreshedIndexes = await Category.collection.indexes();
  const hierarchyIndex = refreshedIndexes.find((index) => index.name === INDEX_NAME);
  if (!hierarchyIndex) await Category.collection.createIndex(INDEX_KEY, { unique: true, name: INDEX_NAME });
  else if (!sameKey(hierarchyIndex.key as Record<string, unknown>, INDEX_KEY) || hierarchyIndex.unique !== true) {
    throw new Error(`Index ${INDEX_NAME} exists with an unexpected definition. The migration stopped.`);
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
  const [finalCategoryCount, finalProductCount, finalCompoundIndexes] = await Promise.all([
    Category.countDocuments({}),
    Product.countDocuments({}),
    Category.collection.indexes(),
  ]);
  const verifiedIndex = finalCompoundIndexes.find((index) => index.name === INDEX_NAME);
  if (finalCategoryCount !== migrationPlan.counts.categories || finalProductCount !== migrationPlan.counts.products) {
    throw new Error("Post-migration count check failed; inspect the database before retrying.");
  }
  if (!verifiedIndex || !sameKey(verifiedIndex.key as Record<string, unknown>, INDEX_KEY) || verifiedIndex.unique !== true) {
    throw new Error("Post-migration compound-index verification failed.");
  }
  console.log(`Category hierarchy migration complete. ${finalCategoryCount} category documents and ${finalProductCount} products remain.`);
  console.log(`Updated ${categoryChanges.length} category documents and ${productBackfill.modifiedCount} products.`);
  console.log(`Verified unique index: ${INDEX_NAME}; legacy name index removed only after compound index verification.`);
};

run()
  .catch((error) => {
    console.error("Category hierarchy migration stopped safely:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
