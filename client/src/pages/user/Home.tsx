import { useEffect, useState } from "react";

import { getCategories } from "../../services/productService";
import { getActiveBanners } from "../../services/bannerService";
import { getPromotionalBanners } from "../../services/promotionalBannerService";

import CategoryGrid from "../../components/user/CategoryGrid";
import PromotionalBanners from "../../components/user/PromotionalBanners";
import HomeBanner from "../../components/user/HomeBanner";
import HomeShimmer from "../../components/user/HomeShimmer";

import type { Banner } from "../../types/banner";
import type { PromotionalBanner } from "../../types/promotionalBanner";
import type { Category } from "../../types/product";

import "./Home.css";

const Home = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [promotionalBanners, setPromotionalBanners] = useState<PromotionalBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerError, setBannerError] = useState("");

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setIsLoading(true);
        setBannerError("");

        const [categoryResponse, bannerResponse, promotionalResponse] =
          await Promise.all([
            getCategories(),
            getActiveBanners(),
            getPromotionalBanners(),
          ]);

        if (categoryResponse?.success) {
          setCategories(categoryResponse.data || []);
        }

        if (bannerResponse?.success) {
          setBanners(bannerResponse.data || []);
        } else {
          setBannerError("Unable to load promotional banners.");
        }
        if (promotionalResponse?.success) setPromotionalBanners(promotionalResponse.data || []);
      } catch (error) {
        console.error("Failed to load home page:", error);
        setBannerError("Unable to load promotional banners.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchHomeData();
  }, []);

  if (isLoading) {
    return <HomeShimmer />;
  }

  return (
    <div className="home-page">
      <HomeBanner banners={banners} />
      <PromotionalBanners banners={promotionalBanners} />

      {bannerError && (
        <p className="home-banner-status" role="status">
          {bannerError}
        </p>
      )}

      <section className="home-section home-category-section">
        <div className="section-heading">
          <h2>Categories</h2>
        </div>

        <CategoryGrid categories={categories} />
      </section>
    </div>
  );
};

export default Home;
