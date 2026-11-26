import { lazy } from "react";
import type { ReactNode } from "react";
import "./ManagementLayout.css";

const AdminSidebar = lazy(() => import("../components/admin/AdminSidebar"));
const VendorSidebar = lazy(() => import("../components/vendor/VendorSidebar"));
const NotificationBell = lazy(() => import("../components/common/NotificationBell"));

type Role = "admin" | "vendor";

export default function ManagementLayout({ role, children }: { role: Role; children: ReactNode }) {
  const Sidebar = role === "admin" ? AdminSidebar : VendorSidebar;
  return (
    <div className="management-shell">
      <Sidebar />
      <NotificationBell />
      <main className="management-content">{children}</main>
    </div>
  );
}
