import { useEffect, useState } from "react";

import { getCategories } from "../../services/productService";
import { getActiveBanners } from "../../services/bannerService";
import { getPromotionalBanners } from "../../services/promotionalBannerService";

import CategoryGrid from "../../components/user/CategoryGrid";
import PromotionalBanners from "../../components/user/PromotionalBanners";
import HomeBanner from "../../components/user/HomeBanner";
import HomeShimmer from "../../components/user/HomeShimmer";
import HomepageProductSections from "../../components/user/HomepageProductSections";

import type { Banner } from "../../types/banner";
import type { PromotionalBanner } from "../../types/promotionalBanner";
import type { Category } from "../../types/product";

import "./Home.css";

const Home = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [promotionalBanners, setPromotionalBanners] = useState<
    PromotionalBanner[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerError, setBannerError] = useState("");

  useEffect(() => {
    let current = true;
    const fetchHomeData = async () => {
      setIsLoading(true);
      setBannerError("");
      const [categoryResult, bannerResult, promotionalResult] = await Promise.allSettled([
        getCategories(),
        getActiveBanners(),
        getPromotionalBanners(),
      ]);
      if (!current) return;

      if (categoryResult.status === "fulfilled" && categoryResult.value?.success) {
        setCategories(categoryResult.value.data || []);
      } else if (categoryResult.status === "rejected") {
        console.warn("Failed to load homepage categories:", categoryResult.reason);
      }

      if (bannerResult.status === "fulfilled" && bannerResult.value?.success) {
        setBanners(bannerResult.value.data || []);
      } else {
        if (bannerResult.status === "rejected") console.warn("Failed to load homepage banners:", bannerResult.reason);
        setBannerError("Unable to load promotional banners.");
      }

      if (promotionalResult.status === "fulfilled" && promotionalResult.value?.success) {
        setPromotionalBanners(promotionalResult.value.data || []);
      } else if (promotionalResult.status === "rejected") {
        console.warn("Failed to load promotional banners:", promotionalResult.reason);
      }
      setIsLoading(false);
    };

    void fetchHomeData();
    return () => { current = false; };
  }, []);

  if (isLoading) {
    return <HomeShimmer />;
  }

  return (
    <div className="home-page">
      <div className="home-content-container">
        <HomeBanner banners={banners} />
        <PromotionalBanners banners={promotionalBanners} />

        {bannerError && (
          <p className="home-banner-status" role="status">
            {bannerError}
          </p>
        )}

        <section className="home-section home-category-section">
          <CategoryGrid categories={categories} />
        </section>
        <HomepageProductSections />
      </div>
    </div>
  );
};

export default Home;
