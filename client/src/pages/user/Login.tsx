import axios from "axios";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { sendPhoneOtp, verifyPhoneOtp } from "../../services/authService";

import { setCredentials } from "../../store/slice/authSlice";

import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";

import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // SEND OTP
  const handleSendOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    try {
      setIsLoading(true);

      const response = await sendPhoneOtp({
        phone: phone.trim(),
      });

      setIsNewUser(response?.data?.isNewUser ?? false);

      setOtpSent(true);
    } catch (error: unknown) {
      console.error("Send OTP error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to send OTP.");
      } else {
        setError("Failed to send OTP.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // VERIFY OTP
  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    const trimmedOtp = otp.trim();

    if (!trimmedOtp) {
      setError("Please enter the OTP.");
      return;
    }

    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    // Name is required only for first-time users
    if (isNewUser && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    try {
      setIsLoading(true);

      const response = await verifyPhoneOtp({
        phone: phone.trim(),
        code: trimmedOtp,
        name: isNewUser ? name.trim() : undefined,
      });

      if (response?.success && response?.data) {
        dispatch(setCredentials(response.data));

        navigate("/", { replace: true });
      } else {
        setError(response?.message || "Invalid OTP.");
      }
    } catch (error: unknown) {
      console.error("Verify OTP error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "OTP verification failed.");
      } else {
        setError("OTP verification failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">QuickCart</div>

        <p className="login-subtitle">Fast delivery. Fresh products.</p>

        <h1>{otpSent ? "Verify OTP" : "Welcome Back"}</h1>

        <p className="login-description">
          {otpSent
            ? `Enter the OTP sent to ${phone}`
            : "Login using your phone number"}
        </p>

        {error && <div className="login-error">{error}</div>}

        {/* PHONE NUMBER FORM */}
        {!otpSent ? (
          <form onSubmit={handleSendOtp}>
            <label htmlFor="phone">Phone Number</label>

            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="Enter phone number"
              value={phone}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "");

                setPhone(value);
              }}
              maxLength={10}
              required
            />

            <button
              type="submit"
              disabled={isLoading || phone.trim().length !== 10}
            >
              {isLoading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : (
          /* OTP FORM */
          <form onSubmit={handleVerifyOtp}>
            {/* Show name ONLY for new users */}
            {isNewUser && (
              <>
                <label htmlFor="name">Name</label>

                <input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </>
            )}

            <label htmlFor="otp">OTP</label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "");

                setOtp(value);
              }}
              maxLength={6}
              required
            />

            <button
              type="submit"
              disabled={
                isLoading ||
                !/^\d{6}$/.test(otp.trim()) ||
                (isNewUser && !name.trim())
              }
            >
              {isLoading ? "Verifying..." : "Verify & Login"}
            </button>

            <button
              type="button"
              className="change-number-button"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
                setName("");
                setError("");
                setIsNewUser(false);
              }}
            >
              Change Phone Number
            </button>
          </form>
        )}

        <div className="login-footer">
          <span>New to QuickCart?</span>

          <span>Login with your phone to continue.</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
