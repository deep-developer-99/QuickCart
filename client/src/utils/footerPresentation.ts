import { FaFacebookF, FaInstagram, FaLinkedinIn, FaLink, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export const footerPortals = [
  { label: "Vendor Login", href: "/vendor/login" },
  { label: "Vendor Registration", href: "/vendor/register" },
  { label: "Admin Login", href: "/admin/login" },
];

export const footerStores = [
  { key: "appStore", label: "Apple App Store", alt: "Download on the App Store", src: "/images/app-badges/app-store.svg", placeholder: "https://apps.apple.com/…" },
  { key: "googlePlay", label: "Google Play Store", alt: "Get it on Google Play", src: "/images/app-badges/play-store.svg", placeholder: "https://play.google.com/store/apps/…" },
] as const;

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

export const footerUrlKey = (href: string) => {
  const base = "https://quickcart.invalid";
  const url = new URL(href, base);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${href.startsWith("/") ? "" : url.origin}${path}${url.search}${url.hash}`;
};

export const getFooterSocialIcon = (label: string, href: string) => {
  const host = isFooterUrl(href) ? new URL(href).hostname.toLowerCase() : "";
  const matches = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  const name = label.trim().toLowerCase();
  if (matches("instagram.com") || name === "instagram") return { Icon: FaInstagram, platform: "instagram" };
  if (matches("facebook.com") || name === "facebook") return { Icon: FaFacebookF, platform: "facebook" };
  if (matches("linkedin.com") || name === "linkedin") return { Icon: FaLinkedinIn, platform: "linkedin" };
  if (matches("youtube.com") || matches("youtu.be") || name === "youtube") return { Icon: FaYoutube, platform: "youtube" };
  if (matches("x.com") || matches("twitter.com") || ["x", "twitter", "x/twitter"].includes(name)) return { Icon: FaXTwitter, platform: "x" };
  return { Icon: FaLink, platform: "other" };
};
