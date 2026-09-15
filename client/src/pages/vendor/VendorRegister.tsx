import axios from "axios";

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerVendor } from "../../services/authService";

import "./VendorRegister.css";

const VendorRegister = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    shopName: "",
    phone: "",
    address: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.password.trim() ||
      !formData.shopName.trim()
    ) {
      setError("Please fill all required fields");
      return;
    }

    try {
      setIsLoading(false);

      const response = await registerVendor({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        shopName: formData.shopName.trim(),
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
      });

      if (response?.success) {
        setSuccess("Registration successful! Waiting for admin approval.");

        setTimeout(() => {
          navigate("/vendor/login");
        }, 1500);
      } else {
        setError(response?.message || "Registration failed.");
      }
    } catch (error: unknown) {
      console.error("Vendor registration error:", error);

      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message || "Vendor registration failed.",
        );
      } else {
        setError("Vendor registration failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="vendor-register-page">
      <div className="vendor-register-card">
        <div className="vendor-register-logo">QuickCart</div>

        <h1>Vendor Registartion</h1>

        <p className="vendor-register-subtitle">
          Register your shop with QuickCart
        </p>

        {error && <div className="vendor-register-error">{error}</div>}

        {success && <div className="vendor-register-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Owner Name *</label>

          <input
            id="name"
            name="name"
            type="text"
            placeholder="Enter owner name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <label htmlFor="shopName">Shop Name *</label>

          <input
            id="shopName"
            name="shopName"
            type="text"
            placeholder="Enter shop name"
            value={formData.shopName}
            onChange={handleChange}
            required
          />

          <label htmlFor="email">Email *</label>

          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <label htmlFor="password">Password *</label>

          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter password"
            value={formData.password}
            onChange={handleChange}
            minLength={6}
            required
          />

          <label htmlFor="phone">Phone</label>

          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Enter phone number"
            value={formData.phone}
            onChange={handleChange}
          />

          <label htmlFor="address">Address</label>

          <input
            id="address"
            name="address"
            type="text"
            placeholder="Enter shop address"
            value={formData.address}
            onChange={handleChange}
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Registering...." : "Register as Vendor"}
          </button>
        </form>

        <div className="vendor-register-footer">
          <span>Already have a vendor account?</span>

          <Link to="/vendor/login">Login here</Link>
        </div>
      </div>
    </div>
  );
};

export default VendorRegister;
