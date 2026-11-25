import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import ProductCard from "./ProductCard";
import {
  getHomepageSectionsSnapshot,
  loadHomepageSections,
  subscribeToHomepageSections,
} from "../../services/homepageSectionService";
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
  const [snapshot, setSnapshot] = useState(getHomepageSectionsSnapshot);

  useEffect(() => {
    const unsubscribe = subscribeToHomepageSections(() => setSnapshot(getHomepageSectionsSnapshot()));
    void loadHomepageSections();
    let lastVisibilityRefreshAt = 0;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilityRefreshAt < 5_000) return;
      lastVisibilityRefreshAt = now;
      void loadHomepageSections({ throttleMs: 5_000 });
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  if (snapshot.isLoading && !snapshot.data) {
    return <div className="homepage-sections-loading" aria-label="Loading product sections">
      {[0, 1].map((row) => <div className="homepage-section-skeleton" key={row}><span /><div>{[0, 1, 2, 3].map((card) => <i key={card} />)}</div></div>)}
    </div>;
  }

  if (snapshot.error && !snapshot.data) return <div className="homepage-sections-error" role="alert"><span>{snapshot.error}</span><button type="button" onClick={() => void loadHomepageSections({ force: true, throttleMs: 0 })}>Retry</button></div>;
  const sections: HomepageSectionPreview[] = snapshot.data ?? [];
  if (!sections.length) return null;

  return <div className="homepage-product-sections">{sections.map((section) => <HomepageProductCarousel key={section.subCategoryId} section={section} />)}</div>;
};

export default HomepageProductSections;
