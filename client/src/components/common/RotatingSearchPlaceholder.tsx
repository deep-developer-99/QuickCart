import type { SearchSuggestion } from "../../services/searchSuggestionService";
import "./SearchBar.css";

interface RotatingSearchPlaceholderProps {
  suggestions: SearchSuggestion[];
  index: number;
  animate?: boolean;
  enabled: boolean;
  fallback: string;
}

const RotatingSearchPlaceholder = ({ suggestions, index, animate = true, enabled, fallback }: RotatingSearchPlaceholderProps) => {
  const isRotating = enabled && suggestions.length > 1;
  const currentIndex = suggestions.length ? index % suggestions.length : 0;
  const currentPhrase = enabled && suggestions.length ? suggestions[currentIndex]?.phrase : fallback;
  if (!isRotating || !animate) return <span className="quickcart-search-suggestion" aria-hidden="true">{currentPhrase || fallback}</span>;
  const previousPhrase = suggestions[(currentIndex - 1 + suggestions.length) % suggestions.length]?.phrase;
  return (
    <span className="quickcart-search-suggestion" aria-hidden="true">
      <span key={currentIndex} className="quickcart-search-suggestion-track">
        <span>{previousPhrase}</span>
        <span>{currentPhrase}</span>
      </span>
    </span>
  );
};

export default RotatingSearchPlaceholder;
