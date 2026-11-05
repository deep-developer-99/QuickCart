import type { Product } from "./product";

export interface HomepageSectionCategory {
  _id: string;
  name: string;
  image?: string;
  isActive: boolean;
  parentCategory: { _id: string; name: string; isActive: boolean };
}

export interface HomepageSectionPreview {
  subCategoryId: string;
  subCategory: HomepageSectionCategory;
  displayOrder: number;
  productLimit: number;
  productCount: number;
  products: Product[];
}

export interface AdminHomepageSection {
  _id?: string;
  subCategoryId: string;
  subCategory: HomepageSectionCategory | null;
  displayOrder: number;
  isActive: boolean;
  productLimit: number;
}

export interface AdminHomepageSectionData {
  subcategories: HomepageSectionCategory[];
  sections: AdminHomepageSection[];
}
