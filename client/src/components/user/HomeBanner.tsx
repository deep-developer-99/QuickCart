import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getCategories } from "../../services/productService";
import type { Banner } from "../../types/banner";
import type { Category } from "../../types/product";

import "./HomeBanner.css";

interface HomeBannerProps {
  banners: Banner[];
}

const FALLBACK_BANNER: Banner = {
  _id: "quickcart-fallback-banner",
  title: "Your everyday essentials, delivered fast.",
  subtitle:
    "Fresh groceries, fruits, dairy, snacks and household essentials — all in one place.",
  image: "",
  buttonText: "Shop Now",
  redirectType: "category",
  order: 0,
  backgroundColor: "#e9f6e7",
  textColor: "#172033",
  isActive: true,
};

const TRANSITION_DURATION = 650;
const AUTOPLAY_DELAY = 5000;

const HomeBanner = ({ banners }: HomeBannerProps) => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const slides = useMemo(
    () => (banners.length > 0 ? banners : [FALLBACK_BANNER]),
    [banners],
  );

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
      setPreviousIndex(0);
    }
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused || isTransitioning) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => {
        const nextIndex = (current + 1) % slides.length;
        setPreviousIndex(current);
        setIsTransitioning(true);
        return nextIndex;
      });
    }, AUTOPLAY_DELAY);

    return () => window.clearInterval(interval);
  }, [isPaused, isTransitioning, slides.length]);

  useEffect(() => {
    if (!isTransitioning) return;

    const timeout = window.setTimeout(() => {
      setIsTransitioning(false);
      setPreviousIndex(activeIndex);
    }, TRANSITION_DURATION);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, isTransitioning]);

  const activeBanner = slides[activeIndex] || slides[0];
  const previousBanner = slides[previousIndex] || activeBanner;

  const handleBannerAction = async () => {
    if (activeBanner.redirectValue) {
      if (activeBanner.redirectType === "category") {
        navigate(`/category/${activeBanner.redirectValue}`);
        return;
      }

      if (activeBanner.redirectType === "product") {
        navigate(`/products/${activeBanner.redirectValue}`);
        return;
      }

      if (/^https?:\/\//i.test(activeBanner.redirectValue)) {
        window.location.href = activeBanner.redirectValue;
        return;
      }

      navigate(activeBanner.redirectValue);
      return;
    }

    try {
      const response = await getCategories();

      if (!response?.success) {
        console.error("Failed to load categories for the Shop Now action.");
        return;
      }

      const categories = (response.data || []) as Category[];

      const groceryCategory = categories.find((category) => {
        const normalizedName = category.name
          .trim()
          .toLowerCase()
          .replace(/&/g, "and")
          .replace(/\s+/g, " ");

        return (
          normalizedName === "grocery" || normalizedName.startsWith("grocery ")
        );
      });

      if (groceryCategory) {
        navigate(`/category/${groceryCategory._id}`);
        return;
      }

      console.error("Grocery category was not found.");
    } catch (error) {
      console.error("Failed to find the Grocery category:", error);
    }
  };

  const changeSlide = (nextIndex: number) => {
    if (
      nextIndex === activeIndex ||
      isTransitioning ||
      nextIndex < 0 ||
      nextIndex >= slides.length
    ) {
      return;
    }

    setPreviousIndex(activeIndex);
    setActiveIndex(nextIndex);
    setIsTransitioning(true);
  };

  const goToSlide = (index: number) => {
    changeSlide(index);
  };

  const goToPrevious = () => {
    const nextIndex = activeIndex === 0 ? slides.length - 1 : activeIndex - 1;

    changeSlide(nextIndex);
  };

  const goToNext = () => {
    changeSlide((activeIndex + 1) % slides.length);
  };

  const renderBannerImage = (
    banner: Banner,
    className: string,
    layerKey: string,
    isVisible: boolean,
  ) => {
    if (!banner.image) return null;

    return (
      <button
        key={layerKey}
        type="button"
        className={`home-banner-image-button ${className} ${
          isVisible ? "is-visible" : "is-hidden"
        }`}
        onClick={() => void handleBannerAction()}
        aria-label={banner.buttonText || banner.title}
        tabIndex={isVisible ? 0 : -1}
      >
        <img
          src={banner.image}
          alt={banner.title}
          className="home-banner-image"
        />
      </button>
    );
  };

  const hasImage = Boolean(activeBanner.image);
  const hasPreviousImage = Boolean(previousBanner.image);

  return (
    <section
      className="home-banner"
      style={{
        backgroundColor: activeBanner.backgroundColor || "#e9f6e7",
        color: activeBanner.textColor || "#172033",
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="QuickCart promotional banners"
    >
      {hasImage ? (
        <>
          {isTransitioning &&
            previousIndex !== activeIndex &&
            hasPreviousImage &&
            renderBannerImage(
              previousBanner,
              "home-banner-image-outgoing",
              `outgoing-${previousIndex}-${activeIndex}`,
              true,
            )}

          {renderBannerImage(
            activeBanner,
            "home-banner-image-incoming",
            `incoming-${activeIndex}`,
            true,
          )}
        </>
      ) : (
        <>
          <div className="home-banner-fallback-art" aria-hidden="true">
            <span>🥦</span>
            <span>🍎</span>
            <span>🥛</span>
            <span>🥕</span>
            <div>🛍️</div>
          </div>

          <div className="home-banner-content">
            <span className="home-banner-eyebrow">
              QUICKCART • SPECIAL OFFER
            </span>
            <h1>{activeBanner.title}</h1>
            {activeBanner.subtitle && <p>{activeBanner.subtitle}</p>}
            {activeBanner.buttonText && (
              <button type="button" onClick={() => void handleBannerAction()}>
                {activeBanner.buttonText}
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </>
      )}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            className="home-banner-arrow home-banner-arrow-left"
            onClick={goToPrevious}
            aria-label="Previous banner"
            disabled={isTransitioning}
          >
            ‹
          </button>

          <button
            type="button"
            className="home-banner-arrow home-banner-arrow-right"
            onClick={goToNext}
            aria-label="Next banner"
            disabled={isTransitioning}
          >
            ›
          </button>

          <div className="home-banner-dots" aria-label="Banner navigation">
            {slides.map((banner, index) => (
              <button
                type="button"
                key={banner._id}
                className={index === activeIndex ? "active" : ""}
                onClick={() => goToSlide(index)}
                aria-label={`Show banner ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                disabled={isTransitioning}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HomeBanner;
