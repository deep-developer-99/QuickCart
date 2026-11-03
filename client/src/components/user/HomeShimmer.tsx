import "./HomeShimmer.css";

const HomeShimmer = () => {
  return (
    <div className="home-shimmer" aria-label="Loading QuickCart home page">
      <div className="home-content-container">
        <div className="home-shimmer-banner shimmer-block" />

        <div className="home-shimmer-promotions" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="home-shimmer-promotion shimmer-block" key={index} />
          ))}
        </div>

        <section className="home-shimmer-section">
          <div className="home-shimmer-heading">
            <span className="shimmer-line shimmer-title" />
          </div>

          <div className="home-shimmer-categories">
            {Array.from({ length: 10 }).map((_, index) => (
              <div className="home-shimmer-category" key={index}>
                <div className="shimmer-block shimmer-category-image" />
                <span className="shimmer-line shimmer-category-name" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomeShimmer;
