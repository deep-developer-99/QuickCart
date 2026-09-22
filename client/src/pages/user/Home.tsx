import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getCategories, getProducts } from "../../services/productService";

import CategoryCarousel from "../../components/user/CategoryCarousel";
import ProductCard from "../../components/user/ProductCard";

import type { Category, Product } from "../../types/product";

import "./Home.css";

const Home = () => {
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
      <section className="home-promo-section">
        <div className="home-promo-content">
          <span className="home-promo-eyebrow">⚡ QUICK & FRESH</span>
          <h1>
            Your everyday essentials,
            <span> delivered in a few clicks.</span>
          </h1>
          <p>
            Groceries, fruits, dairy, snacks and household essentials — all in
            one place.
          </p>

          <div className="home-promo-actions">
            <Link to="/products" className="home-promo-primary">
              Shop Now →
            </Link>
            <span className="home-promo-note">Fast • Fresh • Simple</span>
          </div>
        </div>

        <div className="home-promo-visual" aria-hidden="true">
          <div className="promo-main-bag">🛍️</div>
          <span className="promo-product promo-one">🥛</span>
          <span className="promo-product promo-two">🍎</span>
          <span className="promo-product promo-three">🥦</span>
          <span className="promo-product promo-four">🍪</span>
          <div className="promo-delivery-pill">⚡ Quick Delivery</div>
        </div>
      </section>

      <section className="home-benefits">
        <div className="home-benefit">
          <span>⚡</span>
          <div>
            <strong>Fast Delivery</strong>
            <small>Everyday essentials, quickly</small>
          </div>
        </div>
        <div className="home-benefit">
          <span>🥬</span>
          <div>
            <strong>Fresh Products</strong>
            <small>Quality products for daily needs</small>
          </div>
        </div>
        <div className="home-benefit">
          <span>🔒</span>
          <div>
            <strong>Secure Checkout</strong>
            <small>COD and secure online payment</small>
          </div>
        </div>
      </section>

      <section className="home-section home-category-section">
        <div className="section-heading">
          <div>
            <span>SHOP BY</span>
            <h2>Category</h2>
          </div>
          <div className="section-heading">
            <div>
              <span>SHOP BY</span>
              <h2>Category</h2>
            </div>
          </div>
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
