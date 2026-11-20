import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

const subscribe = (listener: () => void) => {
  const preference = window.matchMedia(query);
  preference.addEventListener("change", listener);
  return () => preference.removeEventListener("change", listener);
};

const getSnapshot = () => window.matchMedia(query).matches;

export const usePrefersReducedMotion = () => useSyncExternalStore(subscribe, getSnapshot);
