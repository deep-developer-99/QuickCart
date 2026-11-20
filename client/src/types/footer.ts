export interface FooterDestination {
  label: string;
  href: string;
  isActive: boolean;
}

export interface FooterLink extends FooterDestination {
  order: number;
}

export interface FooterSettings {
  usefulLinks: FooterLink[];
  socialLinks: FooterDestination[];
  appLinks: { appStore?: string; googlePlay?: string };
  headings: { usefulLinks: string; categories: string; portals: string };
  copyright: string;
  disclaimer: string;
  tagline: string;
}

export type FooterSettingsPatch = Partial<Omit<FooterSettings, "headings">> & {
  headings?: Partial<FooterSettings["headings"]>;
};
