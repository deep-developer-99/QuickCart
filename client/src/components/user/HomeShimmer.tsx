import "./HomeShimmer.css";

const HomeShimmer = () => {
  return (
    <div className="home-shimmer" aria-label="Loading QuickCart home page">
      <div className="home-shimmer-banner shimmer-block" />

      <section className="home-shimmer-section">
        <div className="home-shimmer-heading">
          <div>
            <span className="shimmer-line shimmer-eyebrow" />
            <span className="shimmer-line shimmer-title" />
          </div>
          <span className="shimmer-line shimmer-link" />
        </div>

        <div className="home-shimmer-categories">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="home-shimmer-category" key={index}>
              <div className="shimmer-circle" />
              <span className="shimmer-line shimmer-category-name" />
            </div>
          ))}
        </div>
      </section>

      <section className="home-shimmer-section">
        <div className="home-shimmer-heading">
          <div>
            <span className="shimmer-line shimmer-eyebrow" />
            <span className="shimmer-line shimmer-title" />
          </div>
          <span className="shimmer-line shimmer-link" />
        </div>

        <div className="home-shimmer-products">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="home-shimmer-product" key={index}>
              <div className="shimmer-block shimmer-product-image" />
              <span className="shimmer-line shimmer-product-small" />
              <span className="shimmer-line shimmer-product-name" />
              <span className="shimmer-line shimmer-product-price" />
              <div className="shimmer-button" />
            </div>
          ))}
        </div>
      </section>

      <section className="home-shimmer-section home-shimmer-last-section">
        <div className="shimmer-block shimmer-vendor-banner" />
      </section>
    </div>
  );
};

export default HomeShimmer;
