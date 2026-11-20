import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { FaTrashAlt, FaTimes } from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import { clearAccountDeletionConfirmation, getAccountDeletionConfirmation, getConfirmationRetryAfterSeconds, deleteAccount } from "../../services/accountDeletionService";
import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { clearDeactivatedCustomerStorage } from "../../utils/customerSession";
import { accountDeletionReasons } from "./accountPrivacyContent";
import "./AccountPrivacy.css";

function DeletionDialog({ reason, feedback, onClose }: { reason: string; feedback: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reauth, setReauth] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const confirmationPending = useRef(false);
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    let current = true;
    if (cooldownUntil > Date.now()) return;
    confirmationPending.current = true;
    setLoading(true);
    setError("");
    void getAccountDeletionConfirmation().then((confirmation) => {
      if (current) {
        setToken(confirmation);
        setReauth(false);
      }
    }).catch((requestError: unknown) => {
      if (!current) return;
      const data = axios.isAxiosError(requestError) ? requestError.response?.data : undefined;
      const retryAfter = getConfirmationRetryAfterSeconds(requestError);
      if (data?.code === "REAUTH_REQUIRED") {
        setError(data?.message || "Please sign in again to confirm it is you.");
        setReauth(true);
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 429 && retryAfter) {
        const until = Date.now() + retryAfter * 1000;
        setCooldownUntil(until);
        setCooldownSeconds(retryAfter);
        setError(`Too many confirmation requests. Retry in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`);
      } else {
        setError(data?.message || "Could not prepare confirmation. Please try again.");
        setReauth(false);
      }
    }).finally(() => {
      confirmationPending.current = false;
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [attempt, cooldownUntil]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining === 0) setCooldownUntil(0);
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const finish = () => {
    clearAccountDeletionConfirmation();
    if (user) clearDeactivatedCustomerStorage(user.id);
    dispatch(logoutUser());
    navigate("/account-deactivated", { replace: true });
  };

  const confirm = async () => {
    if (submitting.current || !token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
        setToken("");
        setError("Your confirmation expired. Request a new confirmation.");
        return;
      }
    } catch {
      setToken("");
      setError("Your confirmation is invalid. Request a new confirmation.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await deleteAccount(reason, feedback, token);
      finish();
    } catch (requestError) {
      const data = axios.isAxiosError(requestError) ? requestError.response?.data : undefined;
      // A retry after a lost success response can encounter the revoked session.
      if (data?.code === "ACCOUNT_INACTIVE") { finish(); return; }
      setError(data?.message || "We could not confirm deletion. Please try again.");
      setReauth(data?.code === "REAUTH_REQUIRED");
      if (data?.code === "CONFIRMATION_EXPIRED") {
        clearAccountDeletionConfirmation();
        setToken("");
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const signInAgain = async () => {
    setBusy(true);
    try {
      clearAccountDeletionConfirmation();
      await logout();
      dispatch(logoutUser());
      navigate("/login", { replace: true, state: { from: "/account/delete-account" } });
    } catch {
      setError("Could not sign out. Please try again.");
      setBusy(false);
    }
  };

  return (
    <dialog className="privacy-confirmation" ref={ref} aria-labelledby="privacy-confirmation-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <button className="privacy-close" aria-label="Close confirmation" type="button" disabled={busy} onClick={onClose}><FaTimes /></button>
      <span className="privacy-trash"><FaTrashAlt aria-hidden="true" /></span>
      <h2 id="privacy-confirmation-title">Deleting your account?</h2>
      <p>You will lose access to this account, its order history, and saved details. A future sign-up creates a fresh account.</p>
      <p>Existing orders and payments continue processing. Historical records may be retained. Contact support for outstanding order or payment help.</p>
      {loading && <p role="status">Preparing secure confirmation…</p>}
      {error && <p className="privacy-error" role="alert">{error}</p>}
      {reauth && <button type="button" className="privacy-primary" disabled={busy} onClick={() => void signInAgain()}>Sign in again</button>}
      {!reauth && !loading && !token && <button type="button" className="privacy-secondary" disabled={cooldownSeconds > 0 || confirmationPending.current} onClick={() => {
        if (cooldownSeconds > 0 || confirmationPending.current) return;
        setLoading(true); setError(""); setAttempt((value) => value + 1);
      }}>{cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : "Retry confirmation"}</button>}
      <div className="privacy-confirm-actions">
        <button type="button" className="privacy-secondary" disabled={busy} onClick={onClose} autoFocus>Cancel</button>
        <button type="button" className="privacy-primary" disabled={busy || loading || !token || reauth} onClick={() => void confirm()}>{busy ? "Processing…" : "Delete"}</button>
      </div>
    </dialog>
  );
}

export default function DeleteAccountFeedback() {
  const [params] = useSearchParams();
  const rawReason = params.get("reason");
  const reason = rawReason && /^[0-5]$/.test(rawReason) ? accountDeletionReasons[Number(rawReason)] : undefined;
  const [feedback, setFeedback] = useState("");
  const [confirming, setConfirming] = useState(false);
  if (!reason) return <Navigate to="/account/delete-account" replace />;

  return (
    <section className="account-privacy">
      <Link className="privacy-back" to="/account/delete-account">‹ Choose a reason</Link>
      <h1>{reason.label}</h1>
      <p>{reason.help}</p>
      <label className="privacy-feedback-label" htmlFor="account-deletion-feedback">Feedback (optional)</label>
      <textarea id="account-deletion-feedback" placeholder="Please share your feedback (Optional)" maxLength={1000}
        value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={5} aria-describedby="privacy-feedback-help" />
      <p className="privacy-feedback-help" id="privacy-feedback-help">{feedback.length} / 1000 · Please avoid sensitive information. Optional feedback is retained for up to 30 days, plus database cleanup time.</p>
      <button className="privacy-primary" type="button" onClick={() => setConfirming(true)}>Delete my account</button>
      <p className="privacy-retention">Closing your account removes access. Historical information may be retained for operational, financial, legal, or security needs. Existing orders and payment processing continue.</p>
      {confirming && <DeletionDialog reason={reason.label} feedback={feedback} onClose={() => setConfirming(false)} />}
    </section>
  );
}
