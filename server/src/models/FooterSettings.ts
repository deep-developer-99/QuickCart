import mongoose, { Document, Schema } from "mongoose";

export interface FooterDestination {
  label: string;
  href: string;
  isActive: boolean;
}

export interface FooterLink extends FooterDestination {
  order: number;
}

export interface FooterSettingsDocument extends Document {
  key: "global";
  usefulLinks: FooterLink[];
  socialLinks: FooterDestination[];
  socialLinksConfigured: boolean;
  appLinks: { appStore?: string; googlePlay?: string };
  headings: { usefulLinks: string; categories: string; portals: string };
  copyright: string;
  disclaimer: string;
  tagline: string;
  updatedAt: Date;
}

export const defaultFooterSettings = {
  usefulLinks: [
    { label: "Home", href: "/", isActive: true, order: 0 },
    { label: "Contact Us", href: "/contact", isActive: true, order: 1 },
  ],
  socialLinks: [
    { label: "Instagram", href: "https://www.instagram.com/18.deep_/", isActive: true },
    { label: "Facebook", href: "https://www.facebook.com/share/1LexHT99ej/", isActive: true },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/deepanshu-rawat-69b795261/", isActive: true },
  ],
  appLinks: { appStore: "", googlePlay: "" },
  headings: { usefulLinks: "Useful Links", categories: "Categories", portals: "QuickCart Portals" },
  copyright: "© {year} QuickCart. All rights reserved.",
  disclaimer: "QuickCart makes everyday shopping simple and convenient.",
  tagline: "Your everyday shopping, delivered fast.",
};

export const isFooterUrl = (value: string, allowInternal = false) => {
  if (!value || /[\s\p{Cc}\\]/u.test(value)) return false;
  if (allowInternal && value.startsWith("/") && !value.startsWith("//")) return true;
  if (!/^https?:\/\/[^/]/i.test(value)) return false;

  try {
    const url = new URL(value);
    return Boolean(url.hostname && !url.username && !url.password);
  } catch {
    return false;
  }
};

const linkFields = (allowInternal: boolean) => ({
  label: { type: String, required: true, trim: true, maxlength: 60 },
  href: { type: String, required: true, validate: (value: string) => isFooterUrl(value, allowInternal) },
  isActive: { type: Boolean, default: true },
});

const usefulLinkSchema = new Schema({
  ...linkFields(true),
  order: { type: Number, min: 0, validate: Number.isSafeInteger },
}, { _id: false });

const socialLinkSchema = new Schema(linkFields(false), { _id: false });
const storeUrl = { type: String, validate: (value: string) => value === "" || isFooterUrl(value) };

const footerSchema = new Schema<FooterSettingsDocument>(
  {
    key: { type: String, enum: ["global"], unique: true, default: "global" },
    usefulLinks: {
      type: [usefulLinkSchema],
      default: defaultFooterSettings.usefulLinks,
      validate: [(links: FooterLink[]) => links.length <= 30, "Use up to 30 useful links"],
    },
    socialLinks: {
      type: [socialLinkSchema],
      default: defaultFooterSettings.socialLinks,
      validate: [(links: FooterDestination[]) => links.length <= 10, "Use up to 10 social links"],
    },
    socialLinksConfigured: { type: Boolean, default: false },
    appLinks: { appStore: storeUrl, googlePlay: storeUrl },
    headings: {
      usefulLinks: { type: String, default: defaultFooterSettings.headings.usefulLinks, maxlength: 60 },
      categories: { type: String, default: defaultFooterSettings.headings.categories, maxlength: 60 },
      portals: { type: String, default: defaultFooterSettings.headings.portals, maxlength: 60 },
    },
    copyright: { type: String, default: defaultFooterSettings.copyright, maxlength: 160 },
    disclaimer: { type: String, default: defaultFooterSettings.disclaimer, maxlength: 300 },
    tagline: { type: String, default: defaultFooterSettings.tagline, maxlength: 160 },
  },
  { timestamps: true },
);

const FooterSettings =
  (mongoose.models.FooterSettings as mongoose.Model<FooterSettingsDocument> | undefined) ||
  mongoose.model<FooterSettingsDocument>("FooterSettings", footerSchema);

export default FooterSettings;
