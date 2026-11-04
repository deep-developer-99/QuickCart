export interface CategoryChoice {
  _id: string;
  isActive?: boolean;
  parentCategory?: string | { _id: string } | null;
}

export const getCategoryId = (category: string | { _id: string } | null | undefined) =>
  typeof category === "string" ? category : category?._id || "";

export const activeSubcategoriesForParent = <T extends CategoryChoice>(
  subcategories: T[],
  parentCategoryId: string,
) => subcategories.filter((subcategory) =>
  subcategory.isActive !== false && getCategoryId(subcategory.parentCategory) === parentCategoryId,
);

export const getDefaultSubcategoryId = (subcategories: CategoryChoice[]) =>
  subcategories.find((subcategory) => subcategory.isActive !== false)?._id || "";
