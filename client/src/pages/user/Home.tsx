import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getCategories, getProducts } from "../../services/productService";
import { getActiveBanners } from "../../services/bannerService";

import CategoryCarousel from "../../components/user/CategoryCarousel";
import HomeBanner from "../../components/user/HomeBanner";
import ProductCard from "../../components/user/ProductCard";

import type { Banner } from "../../types/banner";
import type { Category, Product } from "../../types/product";

import "./Home.css";

const Home = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerError, setBannerError] = useState("");

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setIsLoading(true);
        setBannerError("");

        const [categoryResponse, productResponse, bannerResponse] =
          await Promise.all([
            getCategories(),
            getProducts(),
            getActiveBanners(),
          ]);

        if (categoryResponse?.success) {
          setCategories(categoryResponse.data || []);
        }

        if (productResponse?.success) {
          setProducts(productResponse.data || []);
        }

        if (bannerResponse?.success) {
          setBanners(bannerResponse.data || []);
        } else {
          setBannerError("Unable to load promotional banners.");
        }
      } catch (error) {
        console.error("Failed to load home page:", error);
        setBannerError("Unable to load promotional banners.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchHomeData();
  }, []);

  const categorySections = useMemo(() => {
    return categories
      .map((category) => {
        const categoryProducts = products.filter((product) => {
          const productCategoryId =
            typeof product.category === "string"
              ? product.category
              : product.category._id;

          return productCategoryId === category._id;
        });

        return {
          category,
          products: categoryProducts.slice(0, 4),
        };
      })
      .filter((section) => section.products.length > 0)
      .slice(0, 4);
  }, [categories, products]);

  return (
    <div className="home-page">
      <HomeBanner banners={banners} />

      {bannerError && (
        <p className="home-banner-status" role="status">
          {bannerError}
        </p>
      )}

      <section className="home-section home-category-section">
        <div className="section-heading">
          <div>
            <span>SHOP BY</span>
            <h2>Category</h2>
          </div>
          <Link to="/search">View all →</Link>
        </div>

        {isLoading ? (
          <div className="home-loading">Loading categories...</div>
        ) : (
          <CategoryCarousel categories={categories} />
        )}
      </section>

      {isLoading ? (
        <section className="home-section">
          <div className="home-loading">Loading products...</div>
        </section>
      ) : categorySections.length > 0 ? (
        categorySections.map(({ category, products: categoryProducts }) => (
          <section className="home-section product-section" key={category._id}>
            <div className="section-heading">
              <div>
                <span>ESSENTIALS</span>
                <h2>{category.name}</h2>
              </div>
              <Link to={`/category/${category._id}`}>See all →</Link>
            </div>

            <div className="products-grid">
              {categoryProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="home-section">
          <div className="home-empty">
            <h3>No products available</h3>
            <p>Products will appear here soon.</p>
          </div>
        </section>
      )}

      <section className="home-vendor-banner">
        <div>
          <span>GROW WITH QUICKCART</span>
          <h2>Want to sell your products?</h2>
          <p>Join QuickCart as a vendor and start selling online.</p>
        </div>
        <Link to="/vendor/register">Become a Vendor →</Link>
      </section>
    </div>
  );
};

export default Home;
