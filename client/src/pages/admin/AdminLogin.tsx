import axios from "axios";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import { loginAdmin } from "../../services/authService";
import { setCredentials } from "../../store/slice/authSlice";

import "./AdminLogin.css";

const AdminLogin = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsloading] = useState(false);
  const [error, setError] = useState("");

  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    try {
      setIsloading(true);

      const response = await loginAdmin({
        email: email.trim(),
        password,
      });

      if (response?.success && response?.data) {
        dispatch(setCredentials(response.data));

        navigate("/admin/dashboard", { replace: true });
      } else {
        setError(response?.message || "Admin login failed.");
      }
    } catch (error: unknown) {
      console.error("Admin login error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Invalid email or password.");
      } else {
        setError("Admin login failed.");
      }
    } finally {
      setIsloading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-logo">QuickCart</div>

        <h1>Admin Login</h1>

        <p className="admin-login-subtitle">
          Manage your QuickCart application
        </p>

        {error && <div className="admin-login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>

          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter Admin Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter Admin Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Logging in...." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
