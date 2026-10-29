export interface FooterLink {
  label: string;
  href: string;
  isActive: boolean;
  order: number;
}

export interface FooterSettings {
  usefulLinks: FooterLink[];
  socialLinks: { label: string; href: string; isActive: boolean }[];
  appLinks: { appStore?: string; googlePlay?: string };
  headings: { usefulLinks: string; categories: string; portals: string };
  copyright: string;
  disclaimer: string;
}
