import { Link } from "react-router-dom";
import type { PromotionalBanner } from "../../types/promotionalBanner";
import "./PromotionalBanners.css";

const PromotionalBanners = ({ banners }: { banners: PromotionalBanner[] }) => {
  if (!banners.length) return null;
  return (
    <section className="promotional-banners" aria-label="Promotions">
      {banners.slice(0, 3).map((banner) => (
        <Link
          className="promotional-banner-card"
          key={banner._id}
          to={
            banner.redirectType === "category" && banner.redirectValue
              ? `/category/${banner.redirectValue}`
              : banner.redirectType === "product" && banner.redirectValue
                ? `/products/${banner.redirectValue}`
                : "/search"
          }
          aria-label={
            banner.redirectType === "product"
              ? "View featured product"
              : "Browse featured category"
          }
        >
          <img src={banner.image} alt="QuickCart promotional banner" />
        </Link>
      ))}
    </section>
  );
};

export default PromotionalBanners;
