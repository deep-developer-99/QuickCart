import api from "./api";
import type { FooterSettings } from "../types/footer";

export const defaultFooterSettings: FooterSettings = {
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

export const getFooterSettings = async (): Promise<FooterSettings> => {
  const response = await api.get("/footer-settings");
  return { ...defaultFooterSettings, ...(response.data?.data || {}) };
};

export const getAdminFooterSettings = async () => (await api.get("/admin/footer-settings")).data;
export const updateFooterSettings = async (settings: Partial<FooterSettings>) => (await api.patch("/admin/footer-settings", settings)).data;
