import { useEffect, useMemo, useState } from "react";
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
  const getBannerTarget = (banner: Banner) => {
    if (banner.redirectValue && banner.redirectType === "category") {
      return `/category/${banner.redirectValue}`;
    }

    if (banner.redirectValue && banner.redirectType === "product") {
      return `/products/${banner.redirectValue}`;
    }

    return "/search";
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
        onClick={() => navigate(getBannerTarget(banner))}
        aria-label={
          banner.redirectType === "product"
            ? "View featured product"
            : "Browse featured category"
        }
        tabIndex={isVisible ? 0 : -1}
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
  const hasPreviousImage = Boolean(previousBanner.image);

  return (
    <section
      className="home-banner"
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
        <div className="home-banner-empty" aria-label="No banner available" />
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
