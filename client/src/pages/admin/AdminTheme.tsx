import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTheme } from "../../theme/ThemeContext";
import {
  defaultTheme,
  themeColorKeys,
  type ThemeColorKey,
  type ThemeColors,
} from "../../theme/theme";
import "./AdminTheme.css";

const labels: Record<ThemeColorKey, string> = {
  primary: "Primary",
  primaryHover: "Primary hover",
  primaryActive: "Primary active",
  secondary: "Secondary",
  accent: "Accent",
  pageBackground: "Page background",
  secondaryBackground: "Secondary background",
  cardBackground: "Card background",
  surfaceBackground: "Surface background",
  modalBackground: "Modal background",
  headingText: "Heading text",
  bodyText: "Body text",
  mutedText: "Muted text",
  link: "Link",
  linkHover: "Link hover",
  onPrimary: "Text on primary",
  primaryButtonBackground: "Primary button background",
  primaryButtonText: "Primary button text",
  secondaryButtonBackground: "Secondary button background",
  secondaryButtonText: "Secondary button text",
  inputBackground: "Input background",
  inputText: "Input text",
  inputPlaceholder: "Input placeholder",
  inputBorder: "Input border",
  inputFocusBorder: "Input focus border",
  border: "General border",
  activeNavigation: "Active navigation",
  selectedTab: "Selected tab",
  badgeBackground: "Badge background",
  badgeText: "Badge text",
  disabledBackground: "Disabled background",
  disabledText: "Disabled text",
  focusRing: "Focus ring",
  success: "Success",
  warning: "Warning",
  error: "Error",
  info: "Information",
};

const groups: Array<{ title: string; keys: ThemeColorKey[] }> = [
  { title: "Brand", keys: ["primary", "primaryHover", "primaryActive", "secondary", "accent"] },
  { title: "Backgrounds and surfaces", keys: ["pageBackground", "secondaryBackground", "cardBackground", "surfaceBackground", "modalBackground"] },
  { title: "Text and links", keys: ["headingText", "bodyText", "mutedText", "link", "linkHover", "onPrimary"] },
  { title: "Controls", keys: themeColorKeys.slice(16, 33) },
  { title: "Status", keys: ["success", "warning", "error", "info"] },
];

const AdminTheme = () => {
  const { colors, publishTheme, resetTheme } = useTheme();
  const [draft, setDraft] = useState<ThemeColors>(colors);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  // The provider loads asynchronously; keep the editor draft aligned until the first edit.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(colors);
  }, [colors]);

  const previewStyle = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(draft).map(([key, value]) => [
          `--preview-${key}`,
          value,
        ]),
      ) as CSSProperties,
    [draft],
  );

  const updateColor = (key: ThemeColorKey, value: string) => {
    setFeedback("");
    setError("");
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const invalid = themeColorKeys.find(
      (key) => !/^#[0-9a-fA-F]{6}$/.test(draft[key]),
    );
    if (invalid) {
      setError(`${labels[invalid]} must be a six-digit HEX color.`);
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      await publishTheme(draft);
      setFeedback("Theme published successfully.");
    } catch (requestError) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message || "Failed to publish theme."
          : "Failed to publish theme.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const reset = async () => {
    if (
      !window.confirm(
        "Reset all published colors to the default QuickCart theme?",
      )
    ) {
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const next = await resetTheme();
      setDraft(next);
      setFeedback("Theme reset to the QuickCart default.");
    } catch (requestError) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message || "Failed to reset theme."
          : "Failed to reset theme.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-theme-page">
      <div className="admin-theme-header">
        <div>
          <span className="admin-theme-eyebrow">QUICKCART ADMIN</span>
          <h1>Theme Settings</h1>
          <p>Update the published colors used across the storefront.</p>
        </div>
        <div className="admin-theme-actions">
          <button type="button" className="admin-theme-reset" onClick={reset} disabled={isSaving}>
            Reset to Default Theme
          </button>
          <button type="button" className="admin-theme-save" onClick={save} disabled={isSaving}>
            {isSaving ? "Saving..." : "Publish theme"}
          </button>
        </div>
      </div>

      {feedback && <div className="admin-theme-feedback">{feedback}</div>}
      {error && <div className="admin-theme-error">{error}</div>}

      <div className="admin-theme-grid">
        <section className="admin-theme-form">
          {groups.map((group) => (
            <div className="admin-theme-group" key={group.title}>
              <h2>{group.title}</h2>
              <div className="admin-theme-fields">
                {group.keys.map((key) => (
                  <label key={key}>
                    <span>{labels[key]}</span>
                    <div className="admin-theme-input">
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(draft[key]) ? draft[key] : defaultTheme[key]}
                        onChange={(event) => updateColor(key, event.target.value.toUpperCase())}
                        aria-label={`${labels[key]} color picker`}
                      />
                      <input
                        type="text"
                        value={draft[key]}
                        onChange={(event) => updateColor(key, event.target.value)}
                        maxLength={7}
                        aria-label={`${labels[key]} HEX value`}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>

        <aside className="admin-theme-preview" style={previewStyle}>
          <h2>Live preview</h2>
          <div className="theme-preview-nav">QuickCart <span>Home&nbsp;&nbsp; Categories&nbsp;&nbsp; Account</span></div>
          <div className="theme-preview-card">
            <h3>Fresh groceries, delivered fast</h3>
            <p>Preview how headings, body text, surfaces and controls will look.</p>
            <div className="theme-preview-actions">
              <button type="button">Primary action</button>
              <button type="button">Secondary action</button>
            </div>
            <input placeholder="Input preview" readOnly />
            <span className="theme-preview-badge">Available</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdminTheme;
