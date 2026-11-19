import { themeColorKeys, type ThemeColorKey } from "../../theme/theme";

export const categories = [
  { name: "Branding", icon: "◈", keys: themeColorKeys.slice(0, 5) },
  { name: "Website backgrounds", icon: "▤", keys: themeColorKeys.slice(5, 10) },
  { name: "Text and links", icon: "Aa", keys: themeColorKeys.slice(10, 16) },
  { name: "Buttons and inputs", icon: "▣", keys: themeColorKeys.slice(16, 25) },
  {
    name: "Navigation and details",
    icon: "☰",
    keys: themeColorKeys.slice(25, 33),
  },
  { name: "Status messages", icon: "ⓘ", keys: themeColorKeys.slice(33) },
];

export const settings: Record<ThemeColorKey, [string, string]> = {
  primary: [
    "Main brand color",
    "Used for branded details and product card controls.",
  ],
  primaryHover: [
    "Brand hover color",
    "Used by themed actions when the pointer rests over them.",
  ],
  primaryActive: [
    "Deep brand color",
    "Used for navbar details and the sign-in prompt action.",
  ],
  secondary: [
    "Secondary brand detail",
    "Colors a decorative dot on the Contact Us page.",
  ],
  accent: [
    "Accent highlight",
    "Colors decorative accents on the Contact Us page.",
  ],
  pageBackground: [
    "Website page background",
    "Used on the page canvas and sections such as checkout.",
  ],
  secondaryBackground: [
    "Alternate section background",
    "Used behind homepage product sections and navigation details.",
  ],
  cardBackground: [
    "Product card background",
    "Fills themed product cards, order cards and navbar surfaces.",
  ],
  surfaceBackground: [
    "Category page surface",
    "Fills the main Categories page.",
  ],
  modalBackground: [
    "Dialog background",
    "Used in the admin search suggestions dialog.",
  ],
  headingText: [
    "Titles and product names",
    "Colors themed headings, including product card titles.",
  ],
  bodyText: [
    "Main reading text",
    "Used for body copy on pages such as checkout and contact.",
  ],
  mutedText: [
    "Supporting text",
    "Colors secondary details on product cards and account pages.",
  ],
  link: [
    "Website links",
    "Used for themed links, including checkout and profile links.",
  ],
  linkHover: ["Links on hover", "Changes the hover color of themed links."],
  onPrimary: [
    "Text on branded fills",
    "Used on branded elements in product cards and homepage sections.",
  ],
  primaryButtonBackground: [
    "Main button fill",
    "Fills the themed action on the Categories page.",
  ],
  primaryButtonText: [
    "Main button lettering",
    "Colors the label of the themed Categories action.",
  ],
  secondaryButtonBackground: [
    "Secondary action fill",
    "Used behind secondary controls in navigation and checkout.",
  ],
  secondaryButtonText: [
    "Secondary action lettering",
    "Preview example. Storefront controls currently use other text colors.",
  ],
  inputBackground: [
    "Field background",
    "Fills text fields using the shared input styles.",
  ],
  inputText: [
    "Entered field text",
    "Colors values in fields using the shared input styles.",
  ],
  inputPlaceholder: [
    "Empty field hint",
    "Colors placeholder text in shared input styles.",
  ],
  inputBorder: [
    "Field outline",
    "Outlines shared fields and checkout form controls.",
  ],
  inputFocusBorder: [
    "Focused field border",
    "Preview example. Storefront fields currently use other focus styles.",
  ],
  border: [
    "Card edges and dividers",
    "Outlines product cards and divides themed sections.",
  ],
  activeNavigation: [
    "Current navigation item",
    "Preview example. Storefront navigation currently uses other colors.",
  ],
  selectedTab: [
    "Selected category tab",
    "Preview example. Storefront tabs currently use other colors.",
  ],
  badgeBackground: [
    "Status badge fill",
    "Fills active status badges in admin subcategories.",
  ],
  badgeText: [
    "Status badge lettering",
    "Colors active status labels in admin subcategories.",
  ],
  disabledBackground: [
    "Unavailable control fill",
    "Used on disabled product and category controls.",
  ],
  disabledText: [
    "Unavailable control text",
    "Used for subdued details on product cards and other screens.",
  ],
  focusRing: [
    "Keyboard focus outline",
    "Outlines focused controls and category cards.",
  ],
  success: [
    "Success message",
    "Used for positive status details in checkout and orders.",
  ],
  warning: [
    "Warning message",
    "Used for attention indicators on products and order details.",
  ],
  error: [
    "Error message",
    "Used for error or destructive states on product and account screens.",
  ],
  info: [
    "Information message",
    "Used for informational order details and pagination accents.",
  ],
};

export function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, blue] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return r * 0.2126 + g * 0.7152 + blue * 0.0722;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
