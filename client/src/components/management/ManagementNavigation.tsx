import { useId, useRef, useState, type ReactNode } from "react";

interface ManagementNavigationProps {
  role: "admin" | "vendor";
  brand: ReactNode;
  children: ReactNode;
}

export default function ManagementNavigation({ role, brand, children }: ManagementNavigationProps) {
  const [expanded, setExpanded] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  return (
    <aside
      className={`${role}-sidebar management-navigation`}
      aria-label={role === "admin" ? "Admin navigation" : "Vendor navigation"}
      onKeyDown={(event) => {
        if (expanded && event.key === "Escape") {
          setExpanded(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <div className="management-navigation-header">
        {brand}
        <button
          ref={toggleRef}
          className="management-navigation-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={menuId}
          onClick={() => setExpanded(!expanded)}
        >
          Menu
        </button>
      </div>
      <div
        id={menuId}
        className="management-navigation-content"
        data-expanded={expanded}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) {
            setExpanded(false);
          }
        }}
      >
        {children}
      </div>
    </aside>
  );
}
