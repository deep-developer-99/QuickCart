import mongoose, { Types } from "mongoose";

import Category from "../models/Category";
import HomepageSection from "../models/HomepageSection";
import Product from "../models/Product";

const MAX_PRODUCT_LIMIT = 15;
const validationError = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

interface HomepageSectionUpdate {
  subCategoryId: string;
  isActive: boolean;
  productLimit: number;
}

interface CategoryDoc {
  _id: Types.ObjectId;
  name: string;
  image?: string;
  isActive: boolean;
  parentCategory?: Types.ObjectId | null;
}

const sectionCategory = (subcategory: CategoryDoc | undefined, parents: Map<string, CategoryDoc>) => {
  if (!subcategory) return null;
  const parentId = subcategory.parentCategory?.toString();
  const parent = parentId ? parents.get(parentId) : undefined;
  if (!parent) return null;
  return {
    _id: subcategory._id,
    name: subcategory.name,
    image: subcategory.image,
    isActive: subcategory.isActive,
    parentCategory: { _id: parent._id, name: parent.name, isActive: parent.isActive },
  };
};

const loadCategoryMaps = async (subcategoryIds: Types.ObjectId[]) => {
  if (!subcategoryIds.length) return { subcategories: new Map<string, CategoryDoc>(), parents: new Map<string, CategoryDoc>() };
  const subcategories = await Category.find({ _id: { $in: subcategoryIds }, parentCategory: { $ne: null } })
    .select("_id name image isActive parentCategory")
    .lean() as CategoryDoc[];
  const parentIds = [...new Set(subcategories.map((item) => item.parentCategory?.toString()).filter((id): id is string => Boolean(id)))];
  const parentDocs = parentIds.length
    ? await Category.find({ _id: { $in: parentIds }, parentCategory: null }).select("_id name isActive").lean() as CategoryDoc[]
    : [];
  return {
    subcategories: new Map(subcategories.map((item) => [item._id.toString(), item])),
    parents: new Map(parentDocs.map((item) => [item._id.toString(), item])),
  };
};

export const getAdminHomepageSections = async () => {
  const saved = await HomepageSection.find({}).sort({ displayOrder: 1, _id: 1 }).lean();
  const activeSubcategories = await Category.find({ parentCategory: { $ne: null }, isActive: true })
    .select("_id name image isActive parentCategory")
    .sort({ name: 1 })
    .lean() as CategoryDoc[];
  const savedIds = saved.map((section) => section.subCategory as Types.ObjectId);
  const ids = [...new Map([...savedIds, ...activeSubcategories.map((item) => item._id)].map((id) => [id.toString(), id])).values()];
  const maps = await loadCategoryMaps(ids);

  return {
    subcategories: activeSubcategories
      .map((subcategory) => sectionCategory(subcategory, maps.parents))
      .filter((subcategory): subcategory is NonNullable<typeof subcategory> => subcategory !== null && subcategory.parentCategory.isActive),
    sections: saved.map((section) => ({
      _id: String(section._id),
      subCategoryId: String(section.subCategory),
      subCategory: sectionCategory(maps.subcategories.get(String(section.subCategory)), maps.parents),
      displayOrder: section.displayOrder,
      isActive: section.isActive,
      productLimit: section.productLimit,
    })),
  };
};

export const saveHomepageSections = async (input: unknown) => {
  if (!Array.isArray(input)) throw validationError("Homepage sections must be an array.");
  const sections: HomepageSectionUpdate[] = input.map((item: unknown, index: number) => {
    if (!item || typeof item !== "object") throw validationError(`Section ${index + 1} is invalid.`);
    const value = item as Record<string, unknown>;
    const subCategoryId = String(value.subCategoryId ?? "");
    if (!mongoose.isValidObjectId(subCategoryId)) throw validationError(`Section ${index + 1} must reference a valid subcategory.`);
    if (typeof value.isActive !== "boolean") throw validationError(`Section ${index + 1} must include an active status.`);
    const productLimit = Number(value.productLimit);
    if (!Number.isInteger(productLimit) || productLimit < 1 || productLimit > MAX_PRODUCT_LIMIT) {
      throw validationError(`Section ${index + 1} product limit must be between 1 and ${MAX_PRODUCT_LIMIT}.`);
    }
    return { subCategoryId, isActive: value.isActive, productLimit };
  });

  const ids = sections.map((section) => section.subCategoryId);
  if (new Set(ids).size !== ids.length) throw validationError("A subcategory can only be selected once.");

  if (ids.length) {
    const categories = await Category.find({ _id: { $in: ids }, parentCategory: { $ne: null } }).select("_id parentCategory").lean() as Array<{ _id: Types.ObjectId; parentCategory: Types.ObjectId }>;
    const foundIds = new Set(categories.map((category) => category._id.toString()));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    if (missingIds.length) {
      const previouslyConfigured = await HomepageSection.find({ subCategory: { $in: missingIds } }).select("subCategory").lean() as Array<{ subCategory: Types.ObjectId }>;
      const configuredIds = new Set(previouslyConfigured.map((section) => section.subCategory.toString()));
      if (missingIds.some((id) => !configuredIds.has(id))) throw validationError("Every new homepage section must reference an existing subcategory.");
    }
    const parentIds = [...new Set(categories.map((category) => category.parentCategory.toString()))];
    const parents = await Category.find({ _id: { $in: parentIds }, parentCategory: null }).select("_id").lean() as Array<{ _id: Types.ObjectId }>;
    if (parents.length !== parentIds.length) throw validationError("Homepage sections can only reference child categories of a main category.");
  }

  if (sections.length) {
    await HomepageSection.bulkWrite(sections.map((section, displayOrder) => ({
      updateOne: {
        filter: { subCategory: new Types.ObjectId(section.subCategoryId) },
        update: { $set: { displayOrder, isActive: section.isActive, productLimit: section.productLimit } },
        upsert: true,
      },
    })));
  }
  await HomepageSection.deleteMany(ids.length ? { subCategory: { $nin: ids } } : {});

  return getAdminHomepageSections();
};

export const getPublicHomepageSections = async () => {
  const config = await HomepageSection.find({ isActive: true }).sort({ displayOrder: 1, _id: 1 }).lean();
  if (!config.length) return [];

  // A manually edited or legacy document can contain a non-ObjectId reference.
  // Ignore that section instead of allowing it to break the entire public feed.
  const validConfig = config.filter((section) => mongoose.isValidObjectId(section.subCategory));
  if (!validConfig.length) return [];

  const maps = await loadCategoryMaps(validConfig.map((section) => section.subCategory as Types.ObjectId));
  const sections = validConfig.flatMap((section) => {
    const subCategoryId = String(section.subCategory);
    const category = maps.subcategories.get(subCategoryId);
    const parentCategory = category?.parentCategory?.toString();
    if (!category?.isActive || !parentCategory || !maps.parents.get(parentCategory)?.isActive) return [];
    return [{
      subCategoryId,
      subCategory: sectionCategory(category, maps.parents),
      displayOrder: section.displayOrder,
      productLimit: Math.min(MAX_PRODUCT_LIMIT, section.productLimit || MAX_PRODUCT_LIMIT),
    }];
  });
  if (!sections.length) return [];

  // Fetch each section's count and bounded preview independently. This avoids
  // $setWindowFields, which is only supported by MongoDB 5.0+, while preserving
  // the same eligibility rules and per-section product limit on older servers.
  return Promise.all(sections.map(async (section) => {
    const productFilter = {
      subCategory: new Types.ObjectId(section.subCategoryId),
      isActive: true,
      variants: { $elemMatch: { isActive: true, stock: { $gt: 0 } } },
    };
    const productsQuery = Product.find(productFilter);
    if (typeof (productsQuery as any).select === "function") productsQuery.select("-price -discountPrice -stock -legacyPricingReview");
    const [productCount, products] = await Promise.all([
      Product.countDocuments(productFilter),
      productsQuery
        .sort({ createdAt: -1, _id: -1 })
        .limit(section.productLimit)
        .populate("category", "name")
        .lean(),
    ]);

    return { ...section, productCount, products };
  }));
};
