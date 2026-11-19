import { useState, type CSSProperties, type ReactNode } from "react";
import {
  cssVariableNames,
  themeColorKeys,
  type ThemeColorKey as Key,
  type ThemeColors,
} from "../../theme/theme";
import { settings } from "./themeSettings";

const variable = (key: Key) => "var(" + cssVariableNames[key] + ")";
export function ThemeStorefront({
  colors,
  selected,
  select,
}: {
  colors: ThemeColors;
  selected: Key;
  select: (key: Key) => void;
}) {
  const [mobile, setMobile] = useState(false);
  const pick = (
    key: Key,
    children: ReactNode,
    property: keyof CSSProperties = "color",
    extra: CSSProperties = {}
  ) => (
    <span
      data-token={key}
      className={key === selected ? "tc-mark" : ""}
      style={{ [property]: variable(key), ...extra }}
    >
      {children}
    </span>
  );
  const box = (key: Key, children: ReactNode, extra: CSSProperties = {}) =>
    pick(key, children, "backgroundColor", {
      display: "block",
      padding: 12,
      borderRadius: 9,
      ...extra,
    });
  const button = (bg: Key, fg: Key, label: string) =>
    pick(bg, pick(fg, label), "backgroundColor", {
      padding: "6px 12px",
      borderRadius: 7,
      display: "inline-block",
      fontWeight: 700,
    });
  return (
    <aside className="tc-preview">
      <header>
        <h2>Storefront preview</h2>
        <div className="tc-switch">
          {["Desktop", "Mobile"].map((v, i) => (
            <button
              key={v}
              aria-pressed={mobile === Boolean(i)}
              onClick={() => setMobile(Boolean(i))}
            >
              {v}
            </button>
          ))}
        </div>
      </header>
      <p>Choose a surface or its lettering to edit that color.</p>
      <div className="tc-stage">
        <div
          className={"tc-shop " + (mobile ? "tc-mobile" : "")}
          style={
            Object.fromEntries(
              themeColorKeys.map((k) => [cssVariableNames[k], colors[k]])
            ) as CSSProperties
          }
          onClick={(e) => {
            const token = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-token]"
            )?.dataset.token as Key | undefined;
            if (token) select(token);
          }}
        >
          {box(
            "pageBackground",
            <>
              {box(
                "primary",
                <div className="tc-nav">
                  {pick("onPrimary", "QuickCart")}{" "}
                  {button("secondaryBackground", "activeNavigation", "Home")}
                </div>
              )}
              {box(
                "surfaceBackground",
                <>
                  {box(
                    "inputBorder",
                    box(
                      "inputBackground",
                      pick("inputPlaceholder", "⌕   Search for groceries")
                    ),
                    { padding: 1 }
                  )}
                  <div className="tc-tabs">
                    {pick("selectedTab", "Fresh produce", "borderBottomColor", {
                      borderBottomStyle: "solid",
                    })}{" "}
                    <span>Pantry</span> <span>Dairy</span>
                  </div>
                </>
              )}
              {box(
                "secondaryBackground",
                <>
                  <strong>Fresh picks</strong>
                  <div className="tc-products">
                    {["Bananas", "Avocados"].map((name, i) => (
                      <div key={name}>
                        {box(
                          "border",
                          box(
                            "cardBackground",
                            <>
                              <div className="tc-fruit" aria-hidden>
                                {i ? "🥑" : "🍌"}
                              </div>
                              {button(
                                "badgeBackground",
                                "badgeText",
                                "In season"
                              )}
                              <h3>{pick("headingText", name)}</h3>
                              {pick("mutedText", i ? "2 pieces" : "1 dozen")}
                              <div className="tc-price">
                                {pick("bodyText", i ? "₹120" : "₹60")}
                                {i
                                  ? button("primary", "onPrimary", "−  1  +")
                                  : button(
                                      "primaryButtonBackground",
                                      "primaryButtonText",
                                      "Add +"
                                    )}
                              </div>
                            </>
                          ),
                          { padding: 1 }
                        )}
                      </div>
                    ))}
                  </div>
                  {pick("link", "View all produce")} ·{" "}
                  {pick("linkHover", "Link on hover")}
                </>
              )}
              {box(
                "modalBackground",
                <>
                  <strong>Delivery details</strong>
                  {box(
                    "focusRing",
                    box(
                      "inputFocusBorder",
                      box("inputBackground", pick("inputText", "Garden Road")),
                      { padding: 2 }
                    ),
                    { padding: 2, margin: "8px 0" }
                  )}
                  {button(
                    "secondaryButtonBackground",
                    "secondaryButtonText",
                    "Edit address"
                  )}{" "}
                  {button("disabledBackground", "disabledText", "Unavailable")}
                </>
              )}
              <div className="tc-states">
                {pick("primaryHover", "Hover", "backgroundColor", {
                  color: variable("onPrimary"),
                })}{" "}
                {pick("primaryActive", "Pressed", "backgroundColor", {
                  color: variable("onPrimary"),
                })}{" "}
                {pick("secondary", "●")} {pick("accent", "★")}{" "}
              </div>
              <div className="tc-messages">
                {pick("success", "✓ Added to cart")}
                {pick("warning", "△ Low stock")}
                {pick("error", "! Address required")}
                {pick("info", "ⓘ Delivery update")}
              </div>
            </>
          )}
        </div>
      </div>
      <label>
        Inspect preview color{" "}
        <select
          value={selected}
          onChange={(e) => select(e.target.value as Key)}
        >
          {themeColorKeys.map((k) => (
            <option key={k} value={k}>
              {settings[k][0]}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}
