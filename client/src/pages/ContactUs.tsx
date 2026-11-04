import { useEffect, useState } from "react";
import {
  FaInstagram,
  FaFacebookF,
  FaLinkedinIn,
} from "react-icons/fa";

import { defaultFooterSettings, getFooterSettings } from "../services/footerService";
import type { FooterSettings } from "../types/footer";
import "./ContactUs.css";

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/18.deep_/",
    Icon: FaInstagram,
    className: "contact-social-link--instagram",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/1LexHT99ej/",
    Icon: FaFacebookF,
    className: "contact-social-link--facebook",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/deepanshu-rawat-69b795261/",
    Icon: FaLinkedinIn,
    className: "contact-social-link--linkedin",
  },
];

const ContactUs = () => {
  const [settings, setSettings] = useState<FooterSettings>(defaultFooterSettings);

  useEffect(() => {
    getFooterSettings()
      .then(setSettings)
      .catch((error) => console.warn("Failed to load contact page footer settings:", error));
  }, []);

  const copyright = settings.copyright
    .replace("Â©", "©")
    .replace("{year}", String(new Date().getFullYear()));

  return (
    <div className="contact-page">
      <header className="contact-header">
        <a className="contact-brand" href="/" aria-label="QuickCart home">
          <span className="contact-brand-mark" aria-hidden="true">Q</span>
          <span>QuickCart</span>
        </a>
      </header>

      <main className="contact-main">
        <section className="contact-hero" aria-labelledby="contact-title">
          <div className="contact-hero-copy">
            <p className="contact-eyebrow">Here for you, every day</p>
            <h1 id="contact-title">We&apos;d love to help you.</h1>
            <p className="contact-intro">
              Questions about your shopping experience? Our friendly support team is here to
              make things easy. Drop us a note and we&apos;ll be glad to help.
            </p>
            <a className="contact-email" href="mailto:support@quickcart.com">
              <span className="contact-email-icon" aria-hidden="true">@</span>
              <span>support@quickcart.com</span>
              <span className="contact-email-arrow" aria-hidden="true">↗</span>
            </a>
            <p className="contact-response-note">We usually get back to you within one business day.</p>
          </div>
          <div className="contact-hero-art" aria-hidden="true">
            <div className="contact-art-orbit contact-art-orbit-one" />
            <div className="contact-art-orbit contact-art-orbit-two" />
            <div className="contact-art-card">
              <span className="contact-art-sparkle">✦</span>
              <span className="contact-art-bubble">Hi there!</span>
              <span className="contact-art-bag">Q</span>
              <span className="contact-art-caption">Everyday made easier</span>
            </div>
            <span className="contact-art-dot contact-art-dot-one" />
            <span className="contact-art-dot contact-art-dot-two" />
          </div>
        </section>

        <section className="contact-about" aria-labelledby="contact-about-title">
          <div className="contact-about-label">A little about us</div>
          <div>
            <h2 id="contact-about-title">Everyday shopping, made simple.</h2>
            <p>
              QuickCart brings the things you need for everyday life together in one convenient
              place. From discovering local favorites to getting essentials delivered, we make
              shopping feel a little more effortless, one order at a time.
            </p>
          </div>
        </section>
      </main>

      <footer className="contact-footer">
        <div className="contact-footer-inner">
          <a className="contact-footer-brand" href="/" aria-label="QuickCart home">
            <span className="contact-brand-mark" aria-hidden="true">Q</span>
            <span>QuickCart</span>
          </a>
          <div className="contact-footer-right">
            <div className="contact-social-block">
              <span className="contact-social-title">Follow Us</span>
              <div className="contact-social-links">
                {SOCIAL_LINKS.map(({ label, href, Icon, className }) => (
                  <a
                    key={label}
                    className={className}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                  >
                    <Icon aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
            <p className="contact-copyright">{copyright}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ContactUs;
