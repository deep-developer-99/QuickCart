import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getCategories, getProducts } from "../../services/productService";

import CategoryCard from "../../components/user/CategoryCard";
import ProductCard from "../../components/user/ProductCard";

import type { Category, Product } from "../../types/product";

import "./Home.css";

const Home = () => {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setIsLoading(true);

        const [categoryResponse, productResponse] = await Promise.all([
          getCategories(),
          getProducts(),
        ]);

        if (categoryResponse?.success) {
          setCategories(categoryResponse.data || []);
        }

        if (productResponse?.success) {
          setProducts(productResponse.data || []);
        }
      } catch (error) {
        console.error("Failed to load home page:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-content">
          <span className="hero-tag">⚡ Quick & Fresh</span>

          <h1>
            Everything You Need,
            <span> Delivered Fast.</span>
          </h1>

          <p>
            Groceries, fruits, dairy, snacks and everyday essentials delivered
            right to your doorstep.
          </p>

          <div className="hero-buttons">
            <Link to="/products" className="hero-primary-btn">
              Shop Now →
            </Link>

            <Link to="/products" className="hero-secondary-btn">
              Explore Products
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-circle">
            <div className="hero-cart">🛒</div>
            <span className="floating-item item-one">🥦</span>
            <span className="floating-item item-two">🍎</span>
            <span className="floating-item item-three">🥛</span>
            <span className="floating-item item-four">🍪</span>
          </div>
        </div>
      </section>

      <section className="home-features">
        <div className="feature-card">
          <div className="feature-icon">🚀</div>
          <div>
            <h3>Fast Delivery</h3>
            <p>Quick delivery to your doorstep</p>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🥬</div>
          <div>
            <h3>Fresh Products</h3>
            <p>Quality products for everyday needs</p>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🔒</div>
          <div>
            <h3>Secure Checkout</h3>
            <p>Simple and safe ordering</p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <span>EXPLORE</span>
            <h2>Shop by Category</h2>
          </div>

          <Link to="/products">View All →</Link>
        </div>

        {isLoading ? (
          <div className="home-loading">Loading categories...</div>
        ) : (
          <div className="categories-grid">
            {categories.map((category) => (
              <CategoryCard
                key={category._id}
                category={category}
                onClick={() => {
                  navigate(`/products?category=${category._id}`);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="home-section products-section">
        <div className="section-heading">
          <div>
            <span>POPULAR</span>
            <h2>Fresh Products</h2>
          </div>

          <Link to="/products">View All →</Link>
        </div>

        {isLoading ? (
          <div className="home-loading">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="home-empty">
            <h3>No products available</h3>
            <p>Products will appear here soon.</p>
          </div>
        ) : (
          <div className="products-grid">
            {products.slice(0, 8).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="vendor-cta">
        <div>
          <span>GROW WITH QUICKCART</span>
          <h2>Want to sell your products?</h2>
          <p>
            Join QuickCart as a vendor and start selling your products online.
          </p>
        </div>

        <Link to="/vendor/register">Become a Vendor →</Link>
      </section>
    </div>
  );
};

export default Home;
