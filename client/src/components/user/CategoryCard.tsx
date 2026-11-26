import type { Category } from "../../types/product";
import { createCloudinarySrcSet, optimizeCloudinaryImageUrl } from "../../utils/cloudinaryImage";
import "./CategoryCard.css";

interface CategoryCardProps {
  category: Category;
  onClick: () => void;
}

const CategoryCard = ({ category, onClick }: CategoryCardProps) => {
  return (
    <button
      type="button"
      className="category-card"
      onClick={onClick}
    >
      <div className="category-card-image-wrapper">
        {category.image ? (
          <img
            src={optimizeCloudinaryImageUrl(category.image, { width: 240 })}
            srcSet={createCloudinarySrcSet(category.image, [120, 180, 240, 360])}
            sizes="(max-width: 600px) 42vw, 160px"
            alt={category.name}
            className="category-card-image"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="category-card-placeholder">
            {category.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <h3>{category.name}</h3>
    </button>
  );
};

export default CategoryCard;
