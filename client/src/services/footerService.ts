import api from "./api";
import type { FooterSettings, FooterSettingsPatch } from "../types/footer";
import { FooterSettingsCache } from "./footerSettingsCache";

export const PUBLIC_FOOTER_SETTINGS_CACHE_TTL_MS = 5 * 60_000;

export const defaultFooterSettings: FooterSettings = {
  usefulLinks: [
    { label: "Home", href: "/", isActive: true, order: 0 },
    { label: "Contact Us", href: "/contact", isActive: true, order: 1 },
  ],
  socialLinks: [
    { label: "Instagram", href: "https://www.instagram.com/18.deep_/", isActive: true },
    { label: "Facebook", href: "https://www.facebook.com/share/1LexHT99ej/", isActive: true },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/deepanshu-rawat-69b795261/", isActive: true },
  ],
  appLinks: {},
  headings: { usefulLinks: "Useful Links", categories: "Categories", portals: "QuickCart Portals" },
  copyright: "© {year} QuickCart. All rights reserved.",
  disclaimer: "QuickCart makes everyday shopping simple and convenient.",
  tagline: "Your everyday shopping, delivered fast.",
};

interface FooterResponse {
  success: boolean;
  data: FooterSettings;
}

const readSettings = ({ success, data }: FooterResponse): FooterSettings => {
  if (!success || !data) throw new Error("The server did not return footer settings.");

  return {
    usefulLinks: data.usefulLinks
      .map(({ label, href, isActive, order }) => ({ label, href, isActive, order }))
      .sort((a, b) => a.order - b.order),
    socialLinks: data.socialLinks.map(({ label, href, isActive }) => ({ label, href, isActive })),
    headings: { ...defaultFooterSettings.headings, ...data.headings },
    appLinks: { appStore: data.appLinks?.appStore ?? "", googlePlay: data.appLinks?.googlePlay ?? "" },
    copyright: data.copyright ?? defaultFooterSettings.copyright,
    disclaimer: data.disclaimer ?? defaultFooterSettings.disclaimer,
    tagline: data.tagline ?? defaultFooterSettings.tagline,
  };
};

const publicFooterSettingsCache = new FooterSettingsCache<FooterSettings>(PUBLIC_FOOTER_SETTINGS_CACHE_TTL_MS);

export const getFooterSettings = () => publicFooterSettingsCache.get(async () =>
  readSettings((await api.get<FooterResponse>("/footer-settings")).data));

export const invalidatePublicFooterSettings = () => publicFooterSettingsCache.invalidate();

export const getAdminFooterSettings = async (signal?: AbortSignal) =>
  readSettings((await api.get<FooterResponse>("/admin/footer-settings", { signal })).data);

export const updateFooterSettings = async (settings: FooterSettingsPatch) => {
  const updatedSettings = readSettings((await api.patch<FooterResponse>("/admin/footer-settings", settings)).data);
  publicFooterSettingsCache.update(updatedSettings);
  return updatedSettings;
};
