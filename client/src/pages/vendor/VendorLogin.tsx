import axios from "axios";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loginVendor } from "../../services/authService";
import { setCredentials } from "../../store/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";

import "./VendorLogin.css";

const VendorLogin = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated && user?.role === "vendor") {
      navigate("/vendor/dashboard", { replace: true });
    }
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    try {
      setIsLoading(true);

      const response = await loginVendor({
        email: email.trim(),
        password,
      });

      if (response?.success && response?.data) {
        dispatch(setCredentials(response.data));

        navigate("/vendor/dashboard", { replace: true });
      } else {
        setError(response?.message || "Vendor login failed");
      }
    } catch (error: unknown) {
      console.error("Vendor login error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Invalid email or password.");
      } else {
        setError("Vendor login failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="vendor-login-page">
      <div className="vendor-login-card">
        <div className="vendor-login-logo">QuickCart</div>

        <h1>Vendor Login</h1>

        <p className="vendor-login-subtitle">Login to manage your shop</p>

        {error && <div className="vendor-login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>

          <input
            name="email"
            id="email"
            type="email"
            placeholder="Enter Vendor Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Loggin in...." : "Login"}
          </button>
        </form>

        <div className="vendor-login-footer">
          <span>Don't have a vendor account?</span>

          <Link to="/vendor/register">Register your shop</Link>
        </div>
      </div>
    </div>
  );
};

export default VendorLogin;
