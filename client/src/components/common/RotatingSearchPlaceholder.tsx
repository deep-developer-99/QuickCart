import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import type { SearchSuggestionPhrase } from "../../services/searchSuggestionService";
import {
  advanceTypewriter, DEFAULT_DELETING_SPEED, DEFAULT_DISPLAY_DURATION, DEFAULT_TYPING_SPEED,
  getSearchPhrases, SEARCH_PLACEHOLDER_FALLBACK, splitSearchPhrase, type TypewriterFrame,
} from "./searchPlaceholder";
import "./SearchBar.css";

interface RotatingSearchPlaceholderProps {
  suggestions?: readonly SearchSuggestionPhrase[];
  isEnabled?: boolean;
  paused?: boolean;
  /** Explicit opt-in for the Admin preview. */
  previewMotion?: boolean;
  rotationInterval?: number;
  typingSpeedMs?: number;
  deletingSpeedMs?: number;
}

const subscribeToVisibility = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const isPageVisible = () => document.visibilityState !== "hidden";

interface TypewriterProps {
  phrases: string[];
  paused: boolean;
  rotationInterval: number;
  typingSpeedMs: number;
  deletingSpeedMs: number;
}

const Typewriter = ({ phrases, paused, rotationInterval, typingSpeedMs, deletingSpeedMs }: TypewriterProps) => {
  const visible = useSyncExternalStore(subscribeToVisibility, isPageVisible);
  const placeholderRef = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = placeholderRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    // The navbar mounts separate desktop and mobile fields.
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { characters, lengths } = useMemo(() => {
    const characters = phrases.map(splitSearchPhrase);
    return { characters, lengths: characters.map((phrase) => phrase.length) };
  }, [phrases]);
  const [frame, setFrame] = useState<TypewriterFrame>(() => ({ index: 0, length: lengths[0], phase: "hold" }));
  const delay = frame.phase === "hold" ? rotationInterval
    : frame.phase === "delete" ? deletingSpeedMs
    : typingSpeedMs;

  useEffect(() => {
    if (paused || !visible || !inView) return;
    const timer = window.setTimeout(() => {
      if (isPageVisible()) setFrame((current) => advanceTypewriter(current, lengths));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [paused, visible, inView, frame, delay, lengths]);

  const phrase = characters[frame.index].slice(0, frame.length).join("");
  return (
    <span ref={placeholderRef} className="quickcart-search-suggestion" aria-hidden="true">
      Search for "{phrase}{frame.phase === "hold" && '"'}
    </span>
  );
};

const RotatingSearchPlaceholder = ({
  suggestions, isEnabled, paused = false, previewMotion = false, rotationInterval = DEFAULT_DISPLAY_DURATION,
  typingSpeedMs = DEFAULT_TYPING_SPEED, deletingSpeedMs = DEFAULT_DELETING_SPEED,
}: RotatingSearchPlaceholderProps) => {
  const reducedMotion = usePrefersReducedMotion();
  // Only restart when the visible phrase list or its order changes.
  const phraseKey = useMemo(() => JSON.stringify(getSearchPhrases(suggestions ?? [])), [suggestions]);
  const phrases = useMemo(() => JSON.parse(phraseKey) as string[], [phraseKey]);

  if (isEnabled && (!reducedMotion || previewMotion) && phrases.length > 1) {
    return (
      <Typewriter key={phraseKey} phrases={phrases} paused={paused} rotationInterval={rotationInterval}
        typingSpeedMs={typingSpeedMs} deletingSpeedMs={deletingSpeedMs} />
    );
  }
  return (
    <span className="quickcart-search-suggestion" aria-hidden="true">
      {phrases.length ? `Search for "${phrases[0]}"` : SEARCH_PLACEHOLDER_FALLBACK}
    </span>
  );
};

export default RotatingSearchPlaceholder;
