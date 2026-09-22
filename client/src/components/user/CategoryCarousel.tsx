import { useNavigate } from "react-router-dom";

import type { Category } from "../../types/product";
import CategoryCard from "./CategoryCard";

import "./CategoryCarousel.css";

interface CategoryCarouselProps {
  categories: Category[];
}

const CategoryCarousel = ({ categories }: CategoryCarouselProps) => {
  const navigate = useNavigate();

  if (categories.length === 0) {
    return null;
  }

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/category/${categoryId}`);
  };

  return (
    <div className="category-carousel-wrap">
      <div className="category-carousel">
        {categories.map((category) => (
          <div className="category-carousel-item" key={category._id}>
            <CategoryCard
              category={category}
              onClick={() => handleCategoryClick(category._id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryCarousel;
