export const updateTabNotificationBadge = (count: number) => {
  const safeCount = Math.max(0, count);

  document.title = safeCount > 0 ? `(${safeCount}) QuickCart` : "QuickCart";

  const navigatorWithBadge = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };

  if (safeCount > 0) {
    void navigatorWithBadge.setAppBadge?.(safeCount);
  } else {
    void navigatorWithBadge.clearAppBadge?.();
  }
};
