import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import ProductCard from "./ProductCard";
import { getHomepageSections } from "../../services/homepageSectionService";
import type { HomepageSectionPreview } from "../../types/homepageSection";
import "./HomepageProductSections.css";

const HomepageProductCarousel = ({ section }: { section: HomepageSectionPreview }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollBack(track.scrollLeft > 2);
    setCanScrollForward(track.scrollLeft + track.clientWidth < track.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(track);
    window.addEventListener("resize", updateScrollState);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [section.products.length, updateScrollState]);

  const scroll = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * Math.max(240, trackRef.current.clientWidth * 0.8), behavior: "smooth" });
  };

  const parentId = section.subCategory.parentCategory._id;
  const seeAllPath = `/category/${parentId}?subCategory=${encodeURIComponent(section.subCategoryId)}`;

  return (
    <section className="homepage-product-section" aria-labelledby={`homepage-section-${section.subCategoryId}`}>
      <header className="homepage-product-section-heading">
        <h2 id={`homepage-section-${section.subCategoryId}`}>{section.subCategory.name}</h2>
        <Link to={seeAllPath}>See All <span aria-hidden="true">›</span></Link>
      </header>
      {section.products.length ? (
        <div className="homepage-product-carousel-wrap">
          <button type="button" className="homepage-product-arrow previous" aria-label={`Scroll ${section.subCategory.name} products left`} onClick={() => scroll(-1)} disabled={!canScrollBack}>‹</button>
          <div className="homepage-product-track" ref={trackRef} onScroll={updateScrollState}>
            {section.products.map((product) => <div className="homepage-product-card" key={product._id}><ProductCard product={product} variant="compact" /></div>)}
          </div>
          <button type="button" className="homepage-product-arrow next" aria-label={`Scroll ${section.subCategory.name} products right`} onClick={() => scroll(1)} disabled={!canScrollForward}>›</button>
        </div>
      ) : (
        <p className="homepage-product-empty">No products are currently available in this section.</p>
      )}
    </section>
  );
};

const HomepageProductSections = () => {
  const [sections, setSections] = useState<HomepageSectionPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    let inFlight = false;
    let hasLoaded = false;
    const loadSections = async (showLoading: boolean) => {
      if (inFlight) return;
      inFlight = true;
      if (showLoading) setLoading(true);
      try {
        const response = await getHomepageSections();
        if (!current) return;
        if (!response?.success || !Array.isArray(response.data)) throw new Error("Unable to load homepage product sections.");
        setSections(response.data);
        setError("");
        hasLoaded = true;
      } catch (requestError: unknown) {
        if (!current) return;
        const message = requestError instanceof Error ? requestError.message : "Unable to load homepage product sections.";
        if (!hasLoaded) setError(message);
        else console.warn("Homepage product sections could not be refreshed:", message);
      } finally {
        inFlight = false;
        if (current && showLoading) setLoading(false);
      }
    };

    void loadSections(true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadSections(false);
    };
    const refreshInterval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      current = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [retry]);

  if (loading) {
    return <div className="homepage-sections-loading" aria-label="Loading product sections">
      {[0, 1].map((row) => <div className="homepage-section-skeleton" key={row}><span /><div>{[0, 1, 2, 3].map((card) => <i key={card} />)}</div></div>)}
    </div>;
  }

  if (error) return <div className="homepage-sections-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>;
  if (!sections.length) return null;

  return <div className="homepage-product-sections">{sections.map((section) => <HomepageProductCarousel key={section.subCategoryId} section={section} />)}</div>;
};

export default HomepageProductSections;
