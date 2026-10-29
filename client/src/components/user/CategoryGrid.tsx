import { useNavigate } from "react-router-dom";
import type { Category } from "../../types/product";
import CategoryCard from "./CategoryCard";
import "./CategoryGrid.css";

const CategoryGrid = ({ categories }: { categories: Category[] }) => {
  const navigate = useNavigate();
  if (!categories.length) return null;
  return (
    <div className="category-grid">
      {categories.map((category) => (
        <CategoryCard key={category._id} category={category} onClick={() => navigate(`/category/${category._id}`)} />
      ))}
    </div>
  );
};

export default CategoryGrid;
