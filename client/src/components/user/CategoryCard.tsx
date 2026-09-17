import type { Category } from "../../types/product";
import "./CategoryCard.css";

interface CategoryCardProps {
  category: Category;
  onClick: (categoryName: string) => void;
}

const CategoryCard = ({ category, onClick }: CategoryCardProps) => {
  return (
    <button
      type="button"
      className="category-card"
      onClick={() => onClick(category.name)}
    >
      <div className="category-card-image-wrapper">
        {category.image ? (
          <img
            src={category.image}
            alt={category.name}
            className="category-card-image"
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
