import axios from "axios";
import { useEffect, useRef, useState } from "react";

import { signInWithGoogle } from "../../services/firebaseAuthService";
import { loginWithFirebaseGoogle, sendPhoneOtp, verifyPhoneOtp } from "../../services/authService";
import { getFooterSettings } from "../../services/footerService";
import type { FooterLink } from "../../types/footer";
import { setCredentials } from "../../store/slice/authSlice";
import { useAppDispatch } from "../../hooks/reduxHooks";
import { useLoginModal } from "../../context/LoginModalContext";

import "./Login.css";

const RESEND_COOLDOWN_SECONDS = 30;

const Login = () => {
  const dispatch = useAppDispatch();
  const { isLoginModalOpen, closeLoginModal, completeLoginModal } = useLoginModal();
  const dialogRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [policyLinks, setPolicyLinks] = useState<FooterLink[]>([]);

  useEffect(() => {
    getFooterSettings().then((settings) => {
      setPolicyLinks(settings.usefulLinks.filter((link) => link.isActive && /^(terms ?(&|and) conditions|privacy policy)$/i.test(link.label.trim())));
    }).catch(() => setPolicyLinks([]));
  }, []);

  useEffect(() => {
    if (!isLoginModalOpen) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => phoneInputRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus();
    };
  }, [isLoginModalOpen]);

  useEffect(() => {
    if (!isLoginModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        event.preventDefault();
        closeLoginModal();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoginModalOpen, closeLoginModal, isLoading]);

  useEffect(() => {
    if (!otpSent || resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpSent, resendSeconds]);

  const getErrorMessage = (reason: unknown, fallback: string) =>
    axios.isAxiosError(reason) ? reason.response?.data?.message || fallback : reason instanceof Error ? reason.message : fallback;

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setError("");
    setIsLoading(true);
    try {
      const firebaseResult = await signInWithGoogle();
      const response = await loginWithFirebaseGoogle(firebaseResult.idToken);
      if (!response?.success || !response?.data) throw new Error(response?.message || "Google login failed.");
      dispatch(setCredentials(response.data));
      await completeLoginModal();
    } catch (reason: unknown) {
      const firebaseCode = typeof reason === "object" && reason !== null && "code" in reason
        ? String((reason as { code?: unknown }).code || "")
        : "";
      setError(firebaseCode === "auth/popup-closed-by-user" || firebaseCode === "auth/cancelled-popup-request"
        ? "Google sign-in was cancelled."
        : getErrorMessage(reason, "Google login failed."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (event?: React.FormEvent<HTMLFormElement>, isResend = false) => {
    event?.preventDefault();
    if (isLoading || (isResend && resendSeconds > 0)) return;
    setError("");
    setIsLoading(true);
    try {
      const response = await sendPhoneOtp({ phone: phone.trim() });
      setIsNewUser(response?.data?.isNewUser ?? isNewUser);
      setOtpSent(true);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      setOtp("");
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, "Failed to send OTP."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError("Enter the 6-digit code sent to your phone.");
      return;
    }
    if (isNewUser && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await verifyPhoneOtp({ phone: phone.trim(), code: trimmedOtp, name: isNewUser ? name.trim() : undefined });
      if (!response?.success || !response?.data) throw new Error(response?.message || "Invalid OTP.");
      dispatch(setCredentials(response.data));
      await completeLoginModal();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, "OTP verification failed."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoading) closeLoginModal(); }}>
      <div ref={dialogRef} className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title" aria-describedby="login-modal-description">
        <button type="button" className="login-modal-close" onClick={closeLoginModal} disabled={isLoading} aria-label="Close login">×</button>
        <div className="login-modal-brand"><span className="login-modal-mark" aria-hidden="true">Q</span><span>QuickCart</span></div>
        <p className="login-subtitle">Fast delivery. Fresh products.</p>
        <h1 id="login-modal-title">{otpSent ? "Verify your number" : "Welcome to QuickCart"}</h1>
        <p id="login-modal-description" className="login-description">{otpSent ? `Enter the 6-digit code sent to +91 ${phone}` : "Sign in or create an account to get started."}</p>

        {error && <div className="login-error" role="alert">{error}</div>}

        {!otpSent && <>
          <button type="button" className="google-login-button" onClick={handleGoogleLogin} disabled={isLoading}>
            <span className="google-icon" aria-hidden="true">G</span><span>{isLoading ? "Signing in…" : "Continue with Google"}</span>
          </button>
          <div className="login-divider"><span>OR CONTINUE WITH PHONE</span></div>
        </>}

        {!otpSent ? (
          <form onSubmit={(event) => void handleSendOtp(event)}>
            <label htmlFor="login-phone">Mobile number</label>
            <div className="login-phone-field"><span aria-label="India country code">+91</span><input ref={phoneInputRef} id="login-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile number" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} required /></div>
            <button type="submit" disabled={isLoading || phone.length !== 10}>{isLoading ? "Sending code…" : "Continue"}</button>
          </form>
        ) : (
          <form onSubmit={(event) => void handleVerifyOtp(event)}>
            {isNewUser && <><label htmlFor="login-name">Your name</label><input id="login-name" type="text" autoComplete="name" placeholder="Enter your name" value={name} onChange={(event) => setName(event.target.value)} required disabled={isLoading} /></>}
            <label htmlFor="login-otp">Verification code</label>
            <input id="login-otp" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} required disabled={isLoading} />
            <button type="submit" disabled={isLoading || !/^\d{6}$/.test(otp) || (isNewUser && !name.trim())}>{isLoading ? "Verifying…" : "Verify and sign in"}</button>
            <div className="login-otp-actions">
              <button type="button" className="login-text-button" disabled={isLoading || resendSeconds > 0} onClick={() => void handleSendOtp(undefined, true)}>{resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}</button>
              <button type="button" className="login-text-button" disabled={isLoading} onClick={() => { setOtpSent(false); setOtp(""); setName(""); setError(""); setIsNewUser(false); setResendSeconds(0); }}>Change number</button>
            </div>
          </form>
        )}

        <p className="login-legal">By continuing, you agree to our {policyLinks.filter((link) => /terms/i.test(link.label)).map((link) => <PolicyLink key={link.href} link={link} />)}{policyLinks.some((link) => /terms/i.test(link.label)) && policyLinks.some((link) => /privacy/i.test(link.label)) ? " and " : ""}{policyLinks.filter((link) => /privacy/i.test(link.label)).map((link) => <PolicyLink key={link.href} link={link} />)}{policyLinks.length === 0 && "Terms & Conditions and Privacy Policy"}.</p>
      </div>
    </div>
  );
};

const PolicyLink = ({ link }: { link: FooterLink }) => /^https?:\/\//i.test(link.href)
  ? <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
  : <a href={link.href}>{link.label}</a>;

export default Login;
