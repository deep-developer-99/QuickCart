import { useRef, useState, type FormEvent } from "react";
import { FaArrowDown, FaArrowUp, FaLink, FaPlus, FaShareNodes } from "react-icons/fa6";
import type { FooterDestination } from "../../types/footer";
import { footerUrlKey, getFooterSocialIcon, isFooterUrl } from "../../utils/footerPresentation";
import FooterDialog from "./FooterDialog";
import { FooterField, FooterSwitch } from "./FooterFields";

interface LinkManagerProps<T extends FooterDestination> {
  links: T[];
  onChange: (links: T[]) => void;
  makeLink: (link: FooterDestination, previous: T | undefined) => T;
  social?: boolean;
  onMove?: (index: number, direction: -1 | 1) => void;
}

const emptyLink = { label: "", href: "", isActive: true };

export default function FooterLinkManager<T extends FooterDestination>({ links, onChange, makeLink, social, onMove }: LinkManagerProps<T>) {
  const [editor, setEditor] = useState<{ index: number; value: FooterDestination } | null>(null);
  const [removal, setRemoval] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const max = social ? 10 : 30;
  const title = social ? "Social media links" : "Useful links";
  const Icon = social ? FaShareNodes : FaLink;

  const openEditor = (index: number) => {
    setSubmitted(false);
    setEditor({ index, value: links[index] ?? emptyLink });
  };

  const href = editor?.value.href.trim() ?? "";
  const name = editor?.value.label.trim() ?? "";
  const nameError = !name ? "Enter a link name." : "";
  const urlError = !isFooterUrl(href, !social)
    ? (social ? "Enter an address starting with https:// or http://." : "Enter a website path like /contact or a full HTTP(S) URL.")
    : links.some((link, index) => index !== editor?.index && isFooterUrl(link.href, !social) && footerUrlKey(link.href) === footerUrlKey(href))
      ? "This destination is already listed."
      : "";

  const updateLink = (index: number, link: T) =>
    onChange(links.map((entry, position) => position === index ? link : entry));

  const saveLink = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!editor || nameError || urlError) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const link = makeLink({ label: name, href, isActive: editor.value.isActive }, links[editor.index]);
    if (editor.index === -1) onChange([...links, link]);
    else updateLink(editor.index, link);
    setEditor(null);
    setAnnouncement(`${name} ${editor.index === -1 ? "added" : "updated"} in the draft.`);
  };

  const rowOccurrences = new Map<string, number>();

  return (
    <section id={social ? "footer-social" : "footer-links"} className="af-card" aria-label={title}>
      <header className="af-card-header">
        <span className="af-section-icon"><Icon aria-hidden="true" /></span>
        <div>
          <h2>{title}</h2>
          <p>{social ? "Choose which profiles shoppers can follow." : "Manage the shortcuts shoppers see at the bottom of the store."}</p>
        </div>
      </header>
      <div className="af-list-toolbar">
        <span>{links.length} of {max} slots used</span>
        <button type="button" ref={addButton} className="af-button af-button--soft" disabled={links.length >= max} onClick={() => openEditor(-1)}>
          <FaPlus aria-hidden="true" /> {social ? "Add social link" : "Add new link"}
        </button>
      </div>
      {links.length === 0 ? (
        <p className="af-empty">{social ? "No social profiles yet. Add a link to show it in the footer." : "No useful links yet. Add a shortcut to get started."}</p>
      ) : (
        <ul className="af-link-list">
          {links.map((link, index) => {
            const LinkIcon = social ? getFooterSocialIcon(link.label, link.href).Icon : FaLink;
            const key = link.href;
            const occurrence = (rowOccurrences.get(key) ?? 0) + 1;
            rowOccurrences.set(key, occurrence);
            return (
              <li className="af-link-row" key={`${key}:${occurrence}`}>
                <div className="af-link-details">
                  <span className="af-row-icon"><LinkIcon aria-hidden="true" /></span>
                  <div>
                    <strong>{link.label}</strong>
                    <span>{link.href}</span>
                  </div>
                </div>
                <div className="af-row-actions">
                  <FooterSwitch checked={link.isActive} label={`${link.label} visibility`} onClick={() => updateLink(index, { ...link, isActive: !link.isActive })} />
                  {onMove && (
                    <div className="af-reorder">
                      <button type="button" className="af-button af-icon-button" aria-label={`Move ${link.label} up`} title="Move up" disabled={index === 0}
                        onClick={() => { onMove(index, -1); setAnnouncement(`${link.label} moved to position ${index}.`); }}>
                        <FaArrowUp aria-hidden="true" />
                      </button>
                      <button type="button" className="af-button af-icon-button" aria-label={`Move ${link.label} down`} title="Move down" disabled={index === links.length - 1}
                        onClick={() => { onMove(index, 1); setAnnouncement(`${link.label} moved to position ${index + 2}.`); }}>
                        <FaArrowDown aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <button type="button" className="af-button af-button--plain" aria-label={`Edit ${link.label}`} onClick={() => openEditor(index)}>Edit</button>
                  <button type="button" className="af-button af-button--plain af-delete" aria-label={`Delete ${link.label}`} onClick={() => setRemoval(index)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="af-visually-hidden" role="status">{announcement}</div>

      {editor && (
        <FooterDialog title={editor.index === -1 ? (social ? "Add social link" : "Add useful link") : "Edit link"} onClose={() => setEditor(null)}>
          <form className="af-dialog-form" onSubmit={saveLink} noValidate>
            <FooterField label={social ? "Platform name" : "Link name"} value={editor.value.label} maxLength={60} required
              placeholder={social ? "e.g. Instagram" : "e.g. Contact us"} error={submitted ? nameError : undefined}
              onChange={(label) => setEditor({ ...editor, value: { ...editor.value, label } })} />
            <FooterField label="Link URL" value={editor.value.href} required destination
              placeholder={social ? "https://…" : "/contact or https://…"} error={submitted ? urlError : undefined}
              onChange={(href) => setEditor({ ...editor, value: { ...editor.value, href } })} />
            <div className="af-visibility-field">
              <span>Show in footer</span>
              <FooterSwitch checked={editor.value.isActive} label="Show in footer"
                onClick={() => setEditor({ ...editor, value: { ...editor.value, isActive: !editor.value.isActive } })} />
            </div>
            <div className="af-dialog-actions">
              <button type="button" className="af-button" onClick={() => setEditor(null)}>Cancel</button>
              <button type="submit" className="af-button af-button--primary">Save link</button>
            </div>
          </form>
        </FooterDialog>
      )}

      {removal !== null && (
        <FooterDialog title="Delete link?" onClose={() => setRemoval(null)}>
          <div className="af-dialog-form">
            <p>Remove <strong>{links[removal].label}</strong> from your draft? Shoppers will see the change after you save.</p>
            <div className="af-dialog-actions">
              <button type="button" className="af-button" onClick={() => setRemoval(null)}>Cancel</button>
              <button type="button" className="af-button af-button--danger" onClick={() => {
                setAnnouncement(`${links[removal].label} removed from the draft.`);
                onChange(links.filter((_, index) => index !== removal));
                setRemoval(null);
                requestAnimationFrame(() => addButton.current?.focus());
              }}>Delete link</button>
            </div>
          </div>
        </FooterDialog>
      )}
    </section>
  );
}
