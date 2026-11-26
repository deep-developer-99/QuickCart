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
import { peekPublicCached, subscribePublicCache } from "../../services/queryCache";

import "./Home.css";

const Home = () => {
  const [initialCache] = useState(() => ({
    categories: peekPublicCached<{ success: boolean; data: Category[] }>("/categories"),
    banners: peekPublicCached<{ success: boolean; data: Banner[] }>("/banners"),
    promotions: peekPublicCached<{ success: boolean; data: PromotionalBanner[] }>("/promotional-banners"),
  }));
  const hasCachedHomeData = Boolean(initialCache.categories || initialCache.banners || initialCache.promotions);
  const [categories, setCategories] = useState<Category[]>(initialCache.categories?.data ?? []);
  const [banners, setBanners] = useState<Banner[]>(initialCache.banners?.data ?? []);
  const [promotionalBanners, setPromotionalBanners] = useState<
    PromotionalBanner[]
  >(initialCache.promotions?.data ?? []);
  const [isLoading, setIsLoading] = useState(!hasCachedHomeData);
  const [bannerError, setBannerError] = useState("");

  useEffect(() => {
    let current = true;
    const syncCachedSections = () => {
      if (!current) return;
      const categories = peekPublicCached<{ success: boolean; data: Category[] }>("/categories");
      const banners = peekPublicCached<{ success: boolean; data: Banner[] }>("/banners");
      const promotions = peekPublicCached<{ success: boolean; data: PromotionalBanner[] }>("/promotional-banners");
      if (categories) setCategories(categories.data ?? []);
      if (banners) {
        setBanners(banners.data ?? []);
        setBannerError("");
      }
      if (promotions) setPromotionalBanners(promotions.data ?? []);
    };
    const unsubscribe = [
      subscribePublicCache("/categories", syncCachedSections),
      subscribePublicCache("/banners", syncCachedSections),
      subscribePublicCache("/promotional-banners", syncCachedSections),
    ];
    const fetchHomeData = async () => {
      if (!hasCachedHomeData) setIsLoading(true);
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
    return () => { current = false; unsubscribe.forEach((stop) => stop()); };
  }, [hasCachedHomeData]);

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
