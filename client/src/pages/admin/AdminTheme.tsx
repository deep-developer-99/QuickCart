import { useEffect, useState } from "react";
import { useTheme } from "../../theme/ThemeContext";
import {
  cssVariableNames,
  themeColorKeys,
  type ThemeColorKey as Key,
} from "../../theme/theme";
import { categories, contrast, settings } from "./themeSettings";
import { ThemeStorefront } from "./ThemeStorefront";
import "./AdminTheme.css";

const valid = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const pairs: [Key, Key][] = [
  ["primaryButtonText", "primaryButtonBackground"],
  ["secondaryButtonText", "secondaryButtonBackground"],
  ["headingText", "cardBackground"],
  ["bodyText", "pageBackground"],
  ["bodyText", "cardBackground"],
  ["badgeText", "badgeBackground"],
  ["inputText", "inputBackground"],
];
export default function AdminTheme() {
  const { colors, isLoading, publishTheme, resetTheme } = useTheme();
  const [edits, setEdits] = useState<Partial<Record<Key, string>>>({});
  const [selected, setSelected] = useState<Key>("primary");
  const [group, setGroup] = useState("Branding");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const draft = { ...colors, ...edits };
  const preview = { ...colors };
  for (const k of themeColorKeys) if (valid(draft[k])) preview[k] = draft[k];
  const dirty = themeColorKeys.filter(
    (k) => draft[k].toLowerCase() !== colors[k].toLowerCase()
  );
  const invalid = dirty.find((k) => !valid(draft[k]));
  const select = (k: Key) => {
    setQuery("");
    setGroup(categories.find((g) => g.keys.includes(k))!.name);
    setSelected(k);
    requestAnimationFrame(() => document.getElementById("tc-" + k)?.focus());
  };
  const count = dirty.length;
  useEffect(() => {
    if (!count) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const leave = (e: MouseEvent) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (
        link &&
        link.href !== location.href &&
        !e.ctrlKey &&
        !e.metaKey &&
        link.target !== "_blank" &&
        !window.confirm("Leave and discard your unpublished colors?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [count]);
  const edit = (k: Key, value: string) => {
    setSelected(k);
    setEdits((old) => ({ ...old, [k]: value }));
    setNotice("");
    setError("");
  };
  const commit = async (reset: boolean) => {
    if (
      reset &&
      !window.confirm(
        "Restore QuickCart defaults on the live website now and discard all draft edits?"
      )
    )
      return;
    if (!reset && invalid) {
      select(invalid);
      return;
    }
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (reset) await resetTheme();
      else await publishTheme(draft);
      setEdits({});
      setNotice(reset ? "Published defaults restored." : "Theme published.");
    } catch {
      setError(
        "The server could not confirm the change. Your draft is still available. Try again."
      );
    } finally {
      setBusy(false);
    }
  };
  const matches = (k: Key) =>
    [...settings[k], k, cssVariableNames[k]]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  return (
    <main className="tc">
      <header className="tc-head">
        <div>
          <small>STOREFRONT DESIGN</small>
          <h1>Theme customizer</h1>
          <p>Select an element in the preview to change its color.</p>
        </div>
        <div className="tc-actions">
          <span role="status">
            {count} unsaved {count === 1 ? "change" : "changes"}
          </span>
          <button
            disabled={!count || busy}
            onClick={() => {
              if (
                window.confirm(
                  "Discard draft colors and return to the published theme?"
                )
              ) {
                setEdits({});
                setError("");
                setNotice("Draft discarded.");
              }
            }}
          >
            Discard draft
          </button>
          <button
            className="tc-publish"
            disabled={!count || busy || isLoading}
            onClick={() => commit(false)}
          >
            {busy ? "Saving…" : "Publish theme"}
          </button>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="tc-grid">
        <section className="tc-controls">
          <h2>Color settings</h2>
          <input
            type="search"
            aria-label="Search color settings"
            placeholder="Find an element or color token…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {categories.map((g) => {
            const keys = g.keys.filter(matches);
            if (!keys.length) return null;
            const open = Boolean(query) || group === g.name;
            return (
              <section className="tc-group" key={g.name}>
                <button
                  aria-expanded={open}
                  onClick={() => {
                    setQuery("");
                    setGroup(open ? "" : g.name);
                  }}
                >
                  <span aria-hidden>{g.icon}</span>
                  {g.name}
                  <b>{open ? "−" : "+"}</b>
                </button>
                {open &&
                  keys.map((k) => (
                    <div
                      className={
                        "tc-field " + (selected === k ? "tc-selected" : "")
                      }
                      key={k}
                    >
                      <label htmlFor={"tc-" + k}>
                        {settings[k][0]}{" "}
                        {dirty.includes(k) && <small>Modified</small>}
                      </label>
                      <p>{settings[k][1]}</p>
                      <div
                        className="tc-example"
                        aria-hidden
                        style={
                          /background|primary$|secondary$|accent|selectedTab|activeNavigation/i.test(
                            k
                          )
                            ? {
                                backgroundColor: preview[k],
                                color:
                                  contrast(preview[k], "#ffffff") > 4.5
                                    ? "white"
                                    : "#172033",
                              }
                            : /border|ring/i.test(k)
                            ? { borderColor: preview[k] }
                            : { color: preview[k] }
                        }
                      >
                        {/button/i.test(k)
                          ? "Add to cart"
                          : /badge/i.test(k)
                          ? "In season"
                          : /input|focus/i.test(k)
                          ? "Search groceries"
                          : /link/i.test(k)
                          ? "View produce →"
                          : /Text|heading/i.test(k)
                          ? "Fresh groceries"
                          : settings[k][0]}
                      </div>
                      <div className="tc-inputs">
                        <label title="Published color">
                          <i style={{ background: colors[k] }} />
                          Published
                        </label>
                        <label>
                          <input
                            aria-label={settings[k][0] + " draft picker"}
                            type="color"
                            value={preview[k]}
                            disabled={busy || isLoading}
                            onChange={(e) => edit(k, e.target.value)}
                          />
                          Draft
                        </label>
                        <input
                          id={"tc-" + k}
                          aria-invalid={!valid(draft[k])}
                          value={draft[k]}
                          disabled={busy || isLoading}
                          onFocus={() => setSelected(k)}
                          onChange={(e) => edit(k, e.target.value)}
                          maxLength={7}
                        />
                        <button
                          disabled={!dirty.includes(k) || busy}
                          onClick={() => edit(k, colors[k])}
                        >
                          Revert
                        </button>
                      </div>
                      {!valid(draft[k]) && (
                        <small role="alert">
                          Enter six HEX digits after #, such as #15803D.
                        </small>
                      )}
                    </div>
                  ))}
              </section>
            );
          })}
          {!themeColorKeys.some(matches) && <p>No matching settings.</p>}
          <details className="tc-contrast">
            <summary>
              Text contrast ·{" "}
              {
                pairs.filter(([a, b]) => contrast(preview[a], preview[b]) < 4.5)
                  .length
              }{" "}
              warnings
            </summary>
            <p>Normal text should reach 4.5:1.</p>
            {pairs.map(([a, b]) => {
              const ratio = contrast(preview[a], preview[b]);
              return (
                <p key={a + b}>
                  {settings[a][0]} on {settings[b][0].toLowerCase()} ·{" "}
                  <strong>
                    {ratio.toFixed(2)}:1 {ratio < 4.5 ? "Low" : "Pass"}
                  </strong>
                </p>
              );
            })}
          </details>
          <button disabled={busy || isLoading} onClick={() => commit(true)}>
            Restore published defaults…
          </button>
        </section>
        <ThemeStorefront colors={preview} selected={selected} select={select} />
      </div>
    </main>
  );
}
