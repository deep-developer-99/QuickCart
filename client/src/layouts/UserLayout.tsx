import { Outlet, useLocation } from "react-router-dom";

import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import CartDrawerProvider from "../context/CartDrawerProvider";

const UserLayout = () => {
  const { pathname } = useLocation();
  const isSearchPage = pathname === "/search";
  const isCategoriesPage = pathname.replace(/\/+$/, "") === "/categories";

  return (
    <CartDrawerProvider>
      <div className={`user-layout${isSearchPage ? " user-layout--search" : ""}`}>
        <Navbar />

        <main className="user-layout-main">
          <Outlet />
        </main>

        {!isSearchPage && !isCategoriesPage && <Footer />}
      </div>
    </CartDrawerProvider>
  );
};

export default UserLayout;
