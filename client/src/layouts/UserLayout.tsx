import { Outlet } from "react-router-dom";

import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

const UserLayout = () => {
  return (
    <div className="user-layout">
      <Navbar />

      <main className="user-layout-main">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default UserLayout;
