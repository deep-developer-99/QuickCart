import axios from "axios";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight, FaCheck, FaDesktop, FaDownload, FaEye, FaFolderTree,
  FaHeading, FaLink, FaMobileScreen, FaPen, FaShareNodes,
} from "react-icons/fa6";
import FooterContent from "../../components/common/FooterContent";
import { useFooterCategories } from "../../hooks/useFooterCategories";
import { getAdminFooterSettings, updateFooterSettings } from "../../services/footerService";
import type { FooterSettings, FooterSettingsPatch } from "../../types/footer";
import { footerPortals, footerStores, isFooterUrl } from "../../utils/footerPresentation";
import FooterDialog from "./FooterDialog";
import { FooterField } from "./FooterFields";
import FooterLinkManager from "./FooterLinkManager";
import "./AdminFooter.css";

const headingFields = [
  { key: "usefulLinks", label: "Useful links heading" },
  { key: "categories", label: "Categories heading" },
  { key: "portals", label: "QuickCart portals heading" },
] as const;

const textFields = [
  { key: "tagline", label: "Brand tagline", limit: 160 },
  { key: "copyright", label: "Copyright text", limit: 160, hint: "Use {year} to show the current year automatically." },
  { key: "disclaimer", label: "Disclaimer", limit: 300, multiline: true },
] as const;

const sections = [
  { key: "links", label: "Useful links", Icon: FaLink },
  { key: "social", label: "Social media", Icon: FaShareNodes },
  { key: "headings", label: "Headings", Icon: FaHeading },
  { key: "apps", label: "App downloads", Icon: FaDownload },
  { key: "text", label: "Footer text", Icon: FaPen },
  { key: "system", label: "Categories & portals", Icon: FaFolderTree },
];

const footerPatch = (draft: FooterSettings, saved: FooterSettings): FooterSettingsPatch => {
  const patch: FooterSettingsPatch = {};
  if (JSON.stringify(draft.usefulLinks) !== JSON.stringify(saved.usefulLinks)) patch.usefulLinks = draft.usefulLinks;
  if (JSON.stringify(draft.socialLinks) !== JSON.stringify(saved.socialLinks)) patch.socialLinks = draft.socialLinks;
  for (const { key } of textFields) {
    if (draft[key] !== saved[key]) patch[key] = draft[key];
  }
  for (const { key } of headingFields) {
    if (draft.headings[key] !== saved.headings[key]) (patch.headings ??= {})[key] = draft.headings[key];
  }
  for (const { key } of footerStores) {
    if (draft.appLinks[key] !== saved.appLinks[key]) (patch.appLinks ??= {})[key] = draft.appLinks[key];
  }
  return patch;
};

function FooterCard({ section, description, children }: { section: "headings" | "apps" | "text" | "system"; description: string; children: ReactNode }) {
  const { label, Icon } = sections.find(({ key }) => key === section)!;
  return (
    <section id={`footer-${section}`} className="af-card" aria-labelledby={`footer-${section}-title`}>
      <header className="af-card-header">
        <span className="af-section-icon"><Icon aria-hidden="true" /></span>
        <div>
          <h2 id={`footer-${section}-title`}>{label}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function FooterPreview({ settings, onClose }: { settings: FooterSettings; onClose: () => void }) {
  const [mobile, setMobile] = useState(false);
  const categoryData = useFooterCategories();

  return (
    <FooterDialog title="Preview footer" wide onClose={onClose}>
      <div className="af-preview-toolbar">
        <p>Previewing your draft. Links are disabled here.</p>
        <div className="af-preview-modes" role="group" aria-label="Preview width">
          <button type="button" className="af-button" aria-pressed={!mobile} onClick={() => setMobile(false)}>
            <FaDesktop aria-hidden="true" /> Full width
          </button>
          <button type="button" className="af-button" aria-pressed={mobile} onClick={() => setMobile(true)}>
            <FaMobileScreen aria-hidden="true" /> Mobile
          </button>
        </div>
      </div>
      <div className={`af-preview-stage${mobile ? " af-preview-stage--mobile" : ""}`}>
        <FooterContent settings={settings} {...categoryData} preview />
      </div>
    </FooterDialog>
  );
}

function FooterEditor({ initial }: { initial: FooterSettings }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [validated, setValidated] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fields = useRef<HTMLFieldSetElement>(null);
  const saveInFlight = useRef(false);
  const patch = footerPatch(draft, saved);
  const dirty = Object.keys(patch).length > 0;

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const next = new URL(link.href);
      if (next.origin === location.origin && next.pathname === location.pathname && next.search === location.search) return;
      if (!window.confirm("Leave Footer Management with unsaved changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty]);

  const edit = (changes: Partial<FooterSettings>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setNotice("");
    setError("");
  };

  const badHeading = (key: keyof FooterSettings["headings"]) =>
    patch.headings?.[key] !== undefined && !draft.headings[key].trim();
  const badStore = (key: keyof FooterSettings["appLinks"]) => {
    const value = draft.appLinks[key]?.trim() ?? "";
    return patch.appLinks?.[key] !== undefined && Boolean(value && !isFooterUrl(value));
  };

  const save = async () => {
    if (!dirty || saveInFlight.current) return;
    setValidated(true);
    setNotice("");
    setError("");
    if (headingFields.some(({ key }) => badHeading(key)) || footerStores.some(({ key }) => badStore(key))) {
      setError("Check the highlighted fields before saving.");
      requestAnimationFrame(() => fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    try {
      const updated = await updateFooterSettings(patch);
      setSaved(updated);
      setDraft(updated);
      setValidated(false);
      setNotice("Footer settings saved. Your changes are live.");
    } catch (requestError) {
      const detail = axios.isAxiosError<{ message?: string }>(requestError) && requestError.response?.data?.message;
      setError(detail || "The server could not confirm the save. Your draft is still here. Please try again.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const moveLink = (index: number, direction: -1 | 1) => {
    const links = [...draft.usefulLinks];
    const [link] = links.splice(index, 1);
    links.splice(index + direction, 0, link);
    edit({ usefulLinks: links.map((item, order) => ({ ...item, order })) });
  };

  return (
    <>
      <div className="af-publish">
        <div className="af-publish-status" role="status">
          <span className={`af-status-dot${dirty ? " af-status-dot--dirty" : ""}`} />
          {saving ? "Saving changes…" : dirty ? "Unsaved changes" : "All changes saved"}
        </div>
        <div className="af-publish-actions">
          <button type="button" className="af-button af-button--plain" disabled={!dirty || saving} onClick={() => setDiscard(true)}>Discard changes</button>
          <button type="button" className="af-button" onClick={() => setPreview(true)}><FaEye aria-hidden="true" /> Preview footer</button>
          <button type="button" className="af-button af-button--primary" disabled={!dirty || saving} onClick={() => void save()}>
            <FaCheck aria-hidden="true" /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
      {notice && <p className="af-feedback af-feedback--success" role="status">{notice}</p>}
      {error && <p className="af-feedback af-feedback--error" role="alert">{error}</p>}

      <nav className="af-section-nav" aria-label="Footer settings sections">
        {sections.map(({ key, label, Icon }) => <a href={`#footer-${key}`} key={key}><Icon aria-hidden="true" /> {label}</a>)}
      </nav>

      <fieldset className="af-grid" disabled={saving} aria-label="Footer settings" ref={fields}>
        <div className="af-card-column">
          <FooterLinkManager links={draft.usefulLinks} onChange={(usefulLinks) => edit({ usefulLinks })}
            onMove={moveLink} makeLink={(link, previous) => ({
              ...link,
              order: previous?.order ?? Math.min(Number.MAX_SAFE_INTEGER, (draft.usefulLinks.at(-1)?.order ?? -1) + 1),
            })} />
          <FooterLinkManager social links={draft.socialLinks} onChange={(socialLinks) => edit({ socialLinks })} makeLink={(link) => link} />
          <FooterCard section="text" description="Update your brand message and the small print at the bottom of the footer.">
            <div className="af-fields">
              {textFields.map(({ key, label, limit, ...options }) =>
                <FooterField key={key} label={label} maxLength={limit} value={draft[key]} onChange={(value) => edit({ [key]: value })} {...options} />)}
            </div>
          </FooterCard>
        </div>

        <div className="af-card-column">
          <FooterCard section="headings" description="Rename the headings above each group of links.">
            <div className="af-fields">
              {headingFields.map(({ key, label }) =>
                <FooterField key={key} label={label} value={draft.headings[key]} maxLength={60} required
                  error={validated && badHeading(key) ? "Enter a heading." : undefined}
                  onChange={(value) => edit({ headings: { ...draft.headings, [key]: value } })} />)}
            </div>
          </FooterCard>

          <FooterCard section="apps" description="Add your store listing URLs. Leave a URL blank to hide its badge.">
            <div className="af-fields">
              {footerStores.map(({ key, label, alt, src, placeholder }) => (
                <div className="af-store" key={key}>
                  <FooterField label={label} value={draft.appLinks[key] ?? ""} destination placeholder={placeholder}
                    error={validated && badStore(key) ? "Enter a valid HTTP(S) URL." : undefined}
                    onChange={(value) => edit({ appLinks: { ...draft.appLinks, [key]: value } })} />
                  <img src={src} alt={`${alt} badge preview`} />
                </div>
              ))}
            </div>
          </FooterCard>

          <FooterCard section="system" description="Categories follow your store catalog. Portal destinations are managed by QuickCart.">
            <Link className="af-button af-button--soft af-category-link" to="/admin/categories">Manage categories <FaArrowRight aria-hidden="true" /></Link>
            <ul className="af-portal-list">
              {footerPortals.map(({ label, href }) => <li key={href}><strong>{label}</strong><span>{href}</span></li>)}
            </ul>
          </FooterCard>
        </div>
      </fieldset>

      {preview && <FooterPreview settings={{
        ...draft,
        appLinks: { appStore: draft.appLinks.appStore?.trim(), googlePlay: draft.appLinks.googlePlay?.trim() },
      }} onClose={() => setPreview(false)} />}
      {discard && (
        <FooterDialog title="Discard changes?" onClose={() => setDiscard(false)}>
          <div className="af-dialog-form">
            <p>Restore the last saved footer and remove your draft edits?</p>
            <div className="af-dialog-actions">
              <button type="button" className="af-button" onClick={() => setDiscard(false)}>Keep editing</button>
              <button type="button" className="af-button af-button--danger" onClick={() => {
                setDraft(saved);
                setValidated(false);
                setError("");
                setNotice("Draft discarded.");
                setDiscard(false);
              }}>Discard changes</button>
            </div>
          </div>
        </FooterDialog>
      )}
    </>
  );
}

export default function AdminFooter() {
  const [settings, setSettings] = useState<FooterSettings>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getAdminFooterSettings(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setSettings(data); })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="admin-footer-page">
      <div className="af-container">
        <header className="af-page-header">
          <h1>Footer Management</h1>
          <p>Manage the links, app downloads, and information shoppers see at the bottom of your store.</p>
        </header>
        {settings ? <FooterEditor initial={settings} /> : (
          <div className="af-loading af-card">
            {loadError ? <>
              <p role="alert">Couldn’t load footer settings. Please try again.</p>
              <button type="button" className="af-button" onClick={() => {
                setLoadError(false);
                setAttempt((current) => current + 1);
              }}>Try again</button>
            </> : <p role="status">Loading footer settings…</p>}
          </div>
        )}
      </div>
    </div>
  );
}
