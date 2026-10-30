import "./HomeShimmer.css";

const HomeShimmer = () => {
  return (
    <div className="home-shimmer" aria-label="Loading QuickCart home page">
      <div className="home-shimmer-banner shimmer-block" />

      <section className="home-shimmer-section">
        <div className="home-shimmer-heading">
          <span className="shimmer-line shimmer-title" />
        </div>

        <div className="home-shimmer-categories">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="home-shimmer-category" key={index}>
              <div className="shimmer-block shimmer-category-image" />
              <span className="shimmer-line shimmer-category-name" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomeShimmer;
