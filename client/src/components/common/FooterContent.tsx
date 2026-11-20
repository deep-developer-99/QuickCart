import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { FooterSettings } from "../../types/footer";
import type { Category } from "../../types/product";
import { footerPortals, footerStores, footerUrlKey, getFooterSocialIcon, isFooterUrl } from "../../utils/footerPresentation";
import "./Footer.css";

interface FooterContentProps {
  settings: FooterSettings;
  categories: Category[];
  categoryStatus: string;
  preview?: boolean;
  onPortalClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  children?: ReactNode;
}

const categoryColumnSize = 10;

const FooterContent = ({ settings, categories, categoryStatus, preview, onPortalClick, children }: FooterContentProps) => {
  const seen = new Set<string>();
  const usefulLinks = [...settings.usefulLinks].sort((a, b) => a.order - b.order).filter(({ href, isActive }) => {
    if (!isActive || !isFooterUrl(href, true)) return false;
    const key = footerUrlKey(href);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const midpoint = Math.ceil(usefulLinks.length / 2);
  const usefulColumns = [usefulLinks.slice(0, midpoint), usefulLinks.slice(midpoint)];
  const categoryColumns = Array.from({ length: Math.ceil(categories.length / categoryColumnSize) }, (_, index) =>
    categories.slice(index * categoryColumnSize, (index + 1) * categoryColumnSize),
  );
  const socials = settings.socialLinks.filter(({ href, isActive }) => isActive && isFooterUrl(href));
  const stores = footerStores.flatMap((store) => {
    const href = settings.appLinks[store.key];
    return href && isFooterUrl(href) ? [{ ...store, href }] : [];
  });
  const copyright = settings.copyright.replaceAll("{year}", String(new Date().getFullYear()));

  const footerLink = (href: string, content: ReactNode, options: {
    className?: string;
    label?: string;
    newTab?: boolean;
    onClick?: FooterContentProps["onPortalClick"];
  } = {}) => {
    const { className, label, newTab, onClick } = options;
    if (preview) return <a key={href} className={className} aria-label={label}>{content}</a>;
    const attributes = {
      className,
      "aria-label": label,
      target: newTab ? "_blank" : undefined,
      rel: newTab ? "noopener noreferrer" : undefined,
      onClick,
    };
    return href.startsWith("/")
      ? <Link key={href} to={href} {...attributes}>{content}</Link>
      : <a key={href} href={href} {...attributes}>{content}</a>;
  };

  return (
    <footer className="footer">
      <div className="footer-top">
        <section className="footer-link-group">
          <h3>{settings.headings.usefulLinks}</h3>
          <div className="footer-link-columns">
            {usefulColumns.map((column, index) => (
              <div key={index}>
                {column.map(({ label, href }) => footerLink(href, label, {
                  newTab: href === "/contact",
                  onClick: footerPortals.some((portal) => portal.href === href) ? onPortalClick : undefined,
                }))}
              </div>
            ))}
          </div>
        </section>

        <section className="footer-link-group footer-portals">
          <h3>{settings.headings.portals}</h3>
          {footerPortals.map(({ href, label }) => footerLink(href, label, { onClick: onPortalClick }))}
        </section>

        <section className="footer-categories">
          <div className="footer-categories-heading">
            <h3>{settings.headings.categories}</h3>
            {footerLink("/categories", "see all", { className: "footer-see-all", label: "See all categories" })}
          </div>
          {categoryStatus ? (
            <p className="footer-category-status" role="status">{categoryStatus}</p>
          ) : (
            <div className="footer-category-columns">
              {categoryColumns.map((column, index) => (
                <div className="footer-category-column" key={index}>
                  {column.map((category) => footerLink(`/category/${category._id}`, category.name))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="footer-divider" />

      <div className="footer-bottom-main">
        <div className="footer-brand">
          {footerLink("/", "QuickCart", { className: "footer-logo" })}
          {settings.tagline && <p>{settings.tagline}</p>}
        </div>

        <div className="footer-app-links">
          {stores.length > 0 && <>
            <h3>Download App</h3>
            <div className="footer-app-badges">
              {stores.map(({ href, src, alt }) => (
                <span key={src}>{footerLink(href, <img className="footer-app-badge" src={src} alt={alt} />, { newTab: true })}</span>
              ))}
            </div>
          </>}
        </div>

        {socials.length > 0 && (
          <div className="footer-social-section">
            <div className="footer-social-row">
              <h3>Follow Us</h3>
              <div className="footer-socials" aria-label="Follow QuickCart on social media">
                {socials.map(({ href, label }, index) => {
                  const { Icon, platform } = getFooterSocialIcon(label, href);
                  return (
                    <span key={index} title={label}>
                      {footerLink(href, <Icon aria-hidden="true" />, {
                        className: `footer-social-link--${platform}`,
                        label,
                        newTab: true,
                      })}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="footer-divider" />

      {settings.disclaimer && <p className="footer-disclaimer">{settings.disclaimer}</p>}
      <div className="footer-copyright">
        <p>{copyright}</p>
        <p>Made with <span aria-label="love">♥</span> in India</p>
      </div>
      {children}
    </footer>
  );
};

export default FooterContent;
