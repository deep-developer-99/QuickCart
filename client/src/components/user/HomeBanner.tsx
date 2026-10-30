import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Banner } from "../../types/banner";

import "./HomeBanner.css";

interface HomeBannerProps {
  banners: Banner[];
}

const FALLBACK_BANNER: Banner = {
  _id: "quickcart-fallback-banner",
  image: "",
  order: 0,
  isActive: true,
};

const HomeBanner = ({ banners }: HomeBannerProps) => {
  const navigate = useNavigate();

  const slides = useMemo(
    () => (banners.length > 0 ? banners : [FALLBACK_BANNER]),
    [banners],
  );
  const activeBanner = slides[0];
  const getBannerTarget = (banner: Banner) => {
    if (banner.redirectValue && banner.redirectType === "category") {
      return `/category/${banner.redirectValue}`;
    }

    if (banner.redirectValue && banner.redirectType === "product") {
      return `/products/${banner.redirectValue}`;
    }

    return "/search";
  };

  const renderBannerImage = (banner: Banner) => {
    if (!banner.image) return null;

    return (
      <button
        type="button"
        className="home-banner-image-button is-visible"
        onClick={() => navigate(getBannerTarget(banner))}
        aria-label={
          banner.redirectType === "product"
            ? "View featured product"
            : "Browse featured category"
        }
      >
        <img
          src={banner.image}
          alt="QuickCart banner"
          className="home-banner-image"
        />
      </button>
    );
  };

  const hasImage = Boolean(activeBanner.image);
  return (
    <section
      className="home-banner"
      aria-label="QuickCart promotional banners"
    >
      {hasImage ? (
        renderBannerImage(activeBanner)
      ) : (
        <div className="home-banner-empty" aria-label="No banner available" />
      )}
    </section>
  );
};

export default HomeBanner;
