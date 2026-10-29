import mongoose, { Document, Schema } from "mongoose";

export interface FooterLink {
  label: string;
  href: string;
  isActive: boolean;
  order: number;
}

export interface FooterSettingsDocument extends Document {
  key: "global";
  usefulLinks: FooterLink[];
  socialLinks: { label: string; href: string; isActive: boolean }[];
  appLinks: { appStore?: string; googlePlay?: string };
  headings: { usefulLinks: string; categories: string; portals: string };
  copyright: string;
  disclaimer: string;
  updatedAt: Date;
}

export const defaultFooterSettings = {
  usefulLinks: [
    { label: "Home", href: "/", isActive: true, order: 0 },
    { label: "Contact Us", href: "/contact", isActive: true, order: 1 },
    { label: "FAQs", href: "/faqs", isActive: true, order: 2 },
  ],
  socialLinks: [],
  appLinks: {},
  headings: { usefulLinks: "Useful Links", categories: "Categories", portals: "QuickCart Portals" },
  copyright: "© {year} QuickCart. All rights reserved.",
  disclaimer: "QuickCart makes everyday shopping simple and convenient.",
};

const safeUrl = (value: string) =>
  value.startsWith("/") || /^https?:\/\//i.test(value);

const footerSchema = new Schema<FooterSettingsDocument>(
  {
    key: { type: String, enum: ["global"], unique: true, default: "global" },
    usefulLinks: {
      type: [{ label: String, href: String, isActive: Boolean, order: Number }],
      default: defaultFooterSettings.usefulLinks,
      validate: {
        validator: (links: FooterLink[]) =>
          links.length <= 30 &&
          links.every((link) => link.label.length <= 60 && safeUrl(link.href)),
        message: "Footer links contain invalid values",
      },
    },
    socialLinks: {
      type: [{ label: String, href: String, isActive: Boolean }],
      default: [],
      validate: {
        validator: (links: { href: string }[]) =>
          links.length <= 10 && links.every((link) => /^https?:\/\//i.test(link.href)),
        message: "Social links must use HTTP or HTTPS URLs",
      },
    },
    appLinks: {
      appStore: String,
      googlePlay: String,
    },
    headings: {
      usefulLinks: { type: String, default: "Useful Links", maxlength: 60 },
      categories: { type: String, default: "Categories", maxlength: 60 },
      portals: { type: String, default: "QuickCart Portals", maxlength: 60 },
    },
    copyright: { type: String, default: defaultFooterSettings.copyright, maxlength: 160 },
    disclaimer: { type: String, default: defaultFooterSettings.disclaimer, maxlength: 300 },
  },
  { timestamps: true },
);

const FooterSettings =
  mongoose.models.FooterSettings ||
  mongoose.model<FooterSettingsDocument>("FooterSettings", footerSchema);

export default FooterSettings;
