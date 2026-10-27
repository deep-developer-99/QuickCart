import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";

import Pagination from "../common/Pagination";
import {
  createManagedOffer,
  deleteManagedNotification,
  deleteManagedOffer,
  editManagedNotification,
  getEligibleRecipients,
  getManagedNotificationHistory,
  getManagedOffers,
  publishManagedOffer,
  resendOfferNotification,
  resendManagedNotification,
  sendManagedNotification,
  updateOfferContent,
} from "../../services/notificationManagementService";
import type {
  CustomerRecipient,
  ManagedNotification,
  ManagedOffer,
  NotificationHistoryFilters,
  PageInfo,
} from "../../types/notificationManagement";
import type { OfferRedirectType } from "../../types/offer";

import "./OfferNotificationManager.css";

type ManagerRole = "admin" | "vendor";
type Audience = "individual" | "all";
type NotificationKind = "custom" | "offer";
type Confirmation =
  | { kind: "broadcast" }
  | { kind: "delete-offer"; offer: ManagedOffer }
  | { kind: "delete-notification"; notification: ManagedNotification }
  | { kind: "resend-notification"; notification: ManagedNotification }
  | { kind: "publish-offer"; offer: ManagedOffer };

interface OfferDraft {
  title: string;
  message: string;
  redirectType: OfferRedirectType;
  redirectValue: string;
}

const emptyDraft: OfferDraft = {
  title: "",
  message: "",
  redirectType: "category",
  redirectValue: "",
};
const pageInfo = (page: number, limit: number): PageInfo => ({
  currentPage: page,
  limit,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
});

const getRequestError = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.response?.status === 401)
    return "Your session has expired. Sign in again to continue.";
  if (error.response?.status === 403)
    return (
      error.response.data?.message ||
      "You do not have permission to perform this action."
    );
  return error.response?.data?.message || fallback;
};

const createIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const OfferNotificationManager = ({ role }: { role: ManagerRole }) => {
  const isAdmin = role === "admin";
  const [activeTab, setActiveTab] = useState<"offers" | "history">("offers");
  const [offers, setOffers] = useState<ManagedOffer[]>([]);
  const [offerPage, setOfferPage] = useState(1);
  const [offerPagination, setOfferPagination] = useState(pageInfo(1, 50));
  const [history, setHistory] = useState<ManagedNotification[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState(pageInfo(1, 20));
  const [historyFilters, setHistoryFilters] = useState<NotificationHistoryFilters>({});
  const [historyError, setHistoryError] = useState("");
  const [editingNotification, setEditingNotification] = useState<ManagedNotification | null>(null);
  const [notificationEditTitle, setNotificationEditTitle] = useState("");
  const [notificationEditMessage, setNotificationEditMessage] = useState("");
  const [isSavingNotification, setIsSavingNotification] = useState(false);
  const [recipients, setRecipients] = useState<CustomerRecipient[]>([]);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientPagination, setRecipientPagination] = useState(
    pageInfo(1, 20),
  );
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [audience, setAudience] = useState<Audience>("individual");
  const [kind, setKind] = useState<NotificationKind>("custom");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [draft, setDraft] = useState<OfferDraft>(emptyDraft);
  const [editingOffer, setEditingOffer] = useState<ManagedOffer | null>(null);
  const [isOfferFormOpen, setIsOfferFormOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(
    null,
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const isSendingRef = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sendIdempotencyRef = useRef<{ signature: string; key: string } | null>(
    null,
  );
  const resendIdempotencyRef = useRef(new Map<string, string>());
  const campaignResendIdempotencyRef = useRef(new Map<string, string>());

  const publishedOffers = useMemo(
    () => offers.filter((offer) => offer.status === "published"),
    [offers],
  );
  const selectedOffer =
    publishedOffers.find((offer) => offer._id === selectedOfferId) ?? null;
  const previewTitle =
    kind === "offer"
      ? (selectedOffer?.title ?? "Offer title preview")
      : notificationTitle || "Your notification title";
  const previewMessage =
    kind === "offer"
      ? (selectedOffer?.message ??
        "Choose a published offer to preview its message.")
      : notificationMessage || "Your notification message will appear here.";

  const loadOffers = useCallback(async (page: number) => {
    try {
      setIsLoadingOffers(true);
      const response = await getManagedOffers(page, 50);
      setOffers(response.data ?? []);
      setOfferPagination(response.pagination ?? pageInfo(page, 50));
      if (page > (response.pagination?.totalPages ?? 1))
        setOfferPage(response.pagination?.totalPages ?? 1);
    } catch (requestError) {
      setError(getRequestError(requestError, "Could not load offers."));
    } finally {
      setIsLoadingOffers(false);
    }
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    try {
      setIsLoadingHistory(true);
      setHistoryError("");
      const response = await getManagedNotificationHistory(page, 20, historyFilters);
      setHistory(response.data ?? []);
      setHistoryPagination(response.pagination ?? pageInfo(page, 20));
      if (page > (response.pagination?.totalPages ?? 1))
        setHistoryPage(response.pagination?.totalPages ?? 1);
    } catch (requestError) {
      setHistoryError(
        getRequestError(requestError, "Could not load notification history."),
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOffers(offerPage);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOffers, offerPage]);

  useEffect(() => {
    if (activeTab !== "history") return;
    const timer = window.setTimeout(() => {
      void loadHistory(historyPage);
    }, historyFilters.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, historyPage, loadHistory, historyFilters.search]);

  useEffect(() => {
    if (audience !== "individual") return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setIsLoadingRecipients(true);
        const response = await getEligibleRecipients(
          recipientPage,
          recipientSearch.trim(),
          20,
        );
        if (!cancelled) {
          setRecipients(response.data ?? []);
          setRecipientPagination(
            response.pagination ?? pageInfo(recipientPage, 20),
          );
          if (recipientPage > (response.pagination?.totalPages ?? 1))
            setRecipientPage(response.pagination?.totalPages ?? 1);
        }
      } catch (requestError) {
        if (!cancelled)
          setError(
            getRequestError(requestError, "Could not load eligible customers."),
          );
      } finally {
        if (!cancelled) setIsLoadingRecipients(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [audience, recipientPage, recipientSearch]);

  const openCreateOffer = () => {
    setEditingOffer(null);
    setDraft(emptyDraft);
    setError("");
    setIsOfferFormOpen(true);
  };

  const openEditOffer = (offer: ManagedOffer) => {
    setEditingOffer(offer);
    setDraft({
      title: offer.title,
      message: offer.message,
      redirectType: offer.redirectType,
      redirectValue: offer.redirectValue,
    });
    setError("");
    setIsOfferFormOpen(true);
  };

  const saveOffer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSavingOffer(true);
      setError("");
      setSuccess("");
      if (editingOffer) {
        await updateOfferContent(editingOffer._id, {
          title: draft.title.trim(),
          message: draft.message.trim(),
        });
        setSuccess(
          "Offer content saved. No notification was sent. Use Resend notification when you are ready.",
        );
      } else {
        await createManagedOffer({
          ...draft,
          title: draft.title.trim(),
          message: draft.message.trim(),
          redirectValue: draft.redirectValue.trim(),
        });
        setSuccess("Offer draft created.");
      }
      setIsOfferFormOpen(false);
      await loadOffers(offerPage);
    } catch (requestError) {
      setError(getRequestError(requestError, "Could not save the offer."));
    } finally {
      setIsSavingOffer(false);
    }
  };

  const sendNotification = async () => {
    if (isSendingRef.current || isSending) return;
    if (audience === "individual" && selectedRecipientIds.length === 0) {
      setError("Select at least one eligible customer first.");
      return;
    }
    if (kind === "offer" && !selectedOffer) {
      setError("Choose a published offer first.");
      return;
    }
    if (
      kind === "custom" &&
      (!notificationTitle.trim() || !notificationMessage.trim())
    ) {
      setError("Enter a title and message for this custom notification.");
      return;
    }
    if (audience === "all") {
      setConfirmation({ kind: "broadcast" });
      return;
    }
    await performSend();
  };

  const performSend = async (): Promise<boolean> => {
    if (isSendingRef.current || isSending) return false;
    isSendingRef.current = true;
    try {
      setIsSending(true);
      setError("");
      setSuccess("");
      const payload =
        kind === "offer"
          ? ({
              audience,
              kind: "offer",
              category: "offer",
              offerId: selectedOfferId,
              ...(audience === "individual"
                ? { customerIds: [...new Set(selectedRecipientIds)].sort() }
                : {}),
            } as const)
          : ({
              audience: "individual",
              kind: "custom",
              category: "general",
              customerIds: [...new Set(selectedRecipientIds)].sort(),
              title: notificationTitle.trim(),
              message: notificationMessage.trim(),
            } as const);
      const signature = JSON.stringify(payload);
      if (sendIdempotencyRef.current?.signature !== signature) {
        sendIdempotencyRef.current = { signature, key: createIdempotencyKey() };
      }
      const result = await sendManagedNotification(
        payload,
        sendIdempotencyRef.current.key,
      );
      sendIdempotencyRef.current = null;
      setSuccess(
        `Campaign saved for ${result.data.recipients} recipient(s) (${result.data.stored} stored). Firebase accepted ${result.data.accepted}; failed ${result.data.failed}; skipped ${result.data.skipped}.${result.data.duplicate ? " This repeated request was safely ignored." : ""}`,
      );
      setSelectedRecipientIds([]);
      setNotificationTitle("");
      setNotificationMessage("");
      if (activeTab === "history") await loadHistory(historyPage);
      return true;
    } catch (requestError) {
      setError(
        getRequestError(requestError, "Could not send the notification."),
      );
      return false;
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const runOfferAction = async (
    action: "publish" | "resend" | "delete",
    offer: ManagedOffer,
  ) => {
    if (busyOfferId) return;
    try {
      setBusyOfferId(offer._id);
      setError("");
      setSuccess("");
      if (action === "publish") {
        const response = await publishManagedOffer(offer._id);
        const outcome = response.data.lastDispatch;
        setSuccess(
          outcome
            ? `Offer published. Stored ${outcome.stored}; Firebase accepted ${outcome.accepted}; failed ${outcome.failed}; skipped ${outcome.skipped}.`
            : "Offer published and notification dispatch completed.",
        );
      } else if (action === "resend") {
        const idempotencyKey =
          resendIdempotencyRef.current.get(offer._id) ?? createIdempotencyKey();
        resendIdempotencyRef.current.set(offer._id, idempotencyKey);
        const response = await resendOfferNotification(
          offer._id,
          idempotencyKey,
        );
        resendIdempotencyRef.current.delete(offer._id);
        const outcome = response.data;
        setSuccess(
          `${outcome.duplicate ? "Duplicate resend prevented." : "Resend completed."} Stored ${outcome.stored}; Firebase accepted ${outcome.accepted}; failed ${outcome.failed}; skipped ${outcome.skipped}.`,
        );
      } else {
        await deleteManagedOffer(offer._id);
        setSuccess(
          "Offer deleted. Historical notifications are retained; this removes the offer, not its history rows.",
        );
      }
      setConfirmation(null);
      await loadOffers(offerPage);
      if (activeTab === "history") await loadHistory(historyPage);
    } catch (requestError) {
      setError(getRequestError(requestError, `Could not ${action} the offer.`));
    } finally {
      setBusyOfferId(null);
    }
  };

  const runHistoryDelete = async (notification: ManagedNotification) => {
    if (busyNotificationId) return;
    try {
      setBusyNotificationId(notification._id);
      setError("");
      await deleteManagedNotification(notification._id);
      setSuccess("Campaign history hidden. It does not delete the related offer or order, and a delivered push cannot be recalled.");
      setConfirmation(null);
      await loadHistory(historyPage);
    } catch (requestError) {
      setError(
        getRequestError(requestError, "Could not delete the history entry."),
      );
    } finally {
      setBusyNotificationId(null);
    }
  };

  const saveNotificationCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingNotification || isSavingNotification) return;
    try {
      setIsSavingNotification(true);
      setError("");
      await editManagedNotification(editingNotification._id, {
        title: notificationEditTitle.trim(),
        message: notificationEditMessage.trim(),
      });
      setSuccess("Campaign content saved. No push was sent; use Resend campaign when ready.");
      setEditingNotification(null);
      await loadHistory(historyPage);
    } catch (requestError) {
      setError(getRequestError(requestError, "Could not save campaign content."));
    } finally {
      setIsSavingNotification(false);
    }
  };

  const runHistoryResend = async (notification: ManagedNotification) => {
    if (busyNotificationId) return;
    try {
      setBusyNotificationId(notification._id);
      setError("");
      let key = campaignResendIdempotencyRef.current.get(notification._id);
      if (!key) {
        key = createIdempotencyKey();
        campaignResendIdempotencyRef.current.set(notification._id, key);
      }
      const response = await resendManagedNotification(notification._id, key);
      campaignResendIdempotencyRef.current.delete(notification._id);
      const outcome = response.data;
      setSuccess(`${outcome.duplicate ? "Duplicate resend prevented." : "Campaign resent."} Firebase accepted ${outcome.accepted}; failed ${outcome.failed}; skipped ${outcome.skipped}.`);
      setConfirmation(null);
      await loadHistory(historyPage);
    } catch (requestError) {
      setError(getRequestError(requestError, "Could not resend the campaign."));
    } finally {
      setBusyNotificationId(null);
    }
  };

  const confirmAction = async () => {
    if (!confirmation || isConfirming) return;
    setIsConfirming(true);
    try {
      if (confirmation.kind === "broadcast") {
        if (await performSend()) setConfirmation(null);
      } else if (confirmation.kind === "delete-offer")
        await runOfferAction("delete", confirmation.offer);
      else if (confirmation.kind === "delete-notification")
        await runHistoryDelete(confirmation.notification);
      else if (confirmation.kind === "resend-notification")
        await runHistoryResend(confirmation.notification);
      else await runOfferAction("publish", confirmation.offer);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="offer-manager-page">
      <div className="offer-manager-container">
        <header className="offer-manager-header">
          <div>
            <span className="offer-manager-eyebrow">
              {isAdmin ? "QUICKCART ADMIN" : "QUICKCART VENDOR PANEL"}
            </span>
            <h1>Offers &amp; notifications</h1>
            <p>
              Manage offer content, send customer notifications, and review
              Firebase dispatch results.
            </p>
          </div>
          <button
            type="button"
            className="offer-manager-primary"
            onClick={openCreateOffer}
          >
            Create offer draft
          </button>
        </header>

        {success && (
          <div className="offer-manager-alert success" role="status">
            {success}
          </div>
        )}
        {error && (
          <div className="offer-manager-alert error" role="alert">
            {error}
          </div>
        )}

        <section
          className="offer-manager-panel offer-compose"
          aria-labelledby="compose-heading"
        >
          <div className="offer-manager-section-heading">
            <div>
              <span className="offer-manager-kicker">CUSTOMER MESSAGING</span>
              <h2 id="compose-heading">Compose notification</h2>
            </div>
            <span className="offer-manager-note">
              Your account identity and recipient eligibility are verified by
              QuickCart.
            </span>
          </div>

          <div className="offer-manager-form-grid">
            <label>
              Audience
              <select
                value={audience}
                onChange={(event) => {
                  const next = event.target.value as Audience;
                  setAudience(next);
                  if (next === "all") setKind("offer");
                  setError("");
                }}
              >
                <option value="individual">Selected customers</option>
                <option value="all">All Users (customer accounts)</option>
              </select>
            </label>
            <label>
              Notification type
              <select
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as NotificationKind)
                }
                disabled={audience === "all"}
              >
                <option value="custom">Custom notification</option>
                <option value="offer">Published offer</option>
              </select>
            </label>
            {audience === "individual" && (
              <div className="offer-manager-field offer-manager-recipient-field">
                <label htmlFor="recipient-search">
                  Search eligible customers
                </label>
                <input
                  id="recipient-search"
                  type="search"
                  maxLength={100}
                  placeholder="Name, email, or phone"
                  value={recipientSearch}
                  onChange={(event) => {
                    setRecipientSearch(event.target.value);
                    setRecipientPage(1);
                  }}
                />
                <div className="offer-manager-selection-toolbar">
                  <strong aria-live="polite">
                    {selectedRecipientIds.length} {selectedRecipientIds.length === 1 ? "customer" : "customers"} selected
                  </strong>
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipientIds((current) => [...new Set([...current, ...recipients.map((recipient) => recipient._id)])])}
                      disabled={isLoadingRecipients || recipients.length === 0}
                    >
                      Select All on This Page
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipientIds([])}
                      disabled={selectedRecipientIds.length === 0}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div
                  className="offer-manager-recipient-list"
                  aria-live="polite"
                >
                  {isLoadingRecipients ? (
                    <p className="offer-manager-subtle">
                      Loading eligible customers…
                    </p>
                  ) : recipients.length === 0 ? (
                    <p className="offer-manager-subtle">
                      No eligible customers found.
                    </p>
                  ) : (
                    recipients.map((recipient) => {
                      const selected = selectedRecipientIds.includes(recipient._id);
                      return (
                        <label
                          key={recipient._id}
                          className={`offer-manager-recipient${selected ? " selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => setSelectedRecipientIds((current) => event.target.checked
                              ? [...new Set([...current, recipient._id])]
                              : current.filter((id) => id !== recipient._id))}
                          />
                          <span>
                            <strong>{recipient.name}</strong>
                            <small>{recipient.email || "Email unavailable"}</small>
                            <small>{recipient.phone || "Phone unavailable"}</small>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="offer-manager-mini-pagination">
                  <button
                    type="button"
                    disabled={
                      !recipientPagination.hasPrevPage || isLoadingRecipients
                    }
                    onClick={() => setRecipientPage((current) => current - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {recipientPagination.currentPage} of{" "}
                    {recipientPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={
                      !recipientPagination.hasNextPage || isLoadingRecipients
                    }
                    onClick={() => setRecipientPage((current) => current + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            {kind === "offer" ? (
              <label>
                Published offer
                <select
                  value={selectedOfferId}
                  onChange={(event) => setSelectedOfferId(event.target.value)}
                >
                  <option value="">Choose a published offer</option>
                  {publishedOffers.map((offer) => (
                    <option key={offer._id} value={offer._id}>
                      {offer.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Notification title
                  <input
                    value={notificationTitle}
                    maxLength={120}
                    onChange={(event) =>
                      setNotificationTitle(event.target.value)
                    }
                    placeholder="Title customers will see"
                  />
                  <small>{notificationTitle.length}/120</small>
                </label>
                <label className="offer-manager-message-field">
                  Message
                  <textarea
                    value={notificationMessage}
                    maxLength={240}
                    onChange={(event) =>
                      setNotificationMessage(event.target.value)
                    }
                    placeholder="Write a concise message"
                  />
                  <small>{notificationMessage.length}/240</small>
                </label>
              </>
            )}
          </div>

          {kind === "offer" && audience === "all" && (
            <p className="offer-manager-broadcast-note">
              All customer accounts will be targeted. Admin and vendor accounts
              are excluded.
            </p>
          )}

          <div className="offer-manager-preview" aria-live="polite">
            <span className="offer-manager-kicker">PREVIEW</span>
            <strong>{previewTitle}</strong>
            <p>{previewMessage}</p>
            {selectedOffer && (
              <small>
                Navigation: {selectedOffer.redirectType} ·{" "}
                {selectedOffer.redirectValue}
              </small>
            )}
          </div>
          <div className="offer-manager-submit-row">
            <span className="offer-manager-subtle">
              {audience === "all"
                ? "A confirmation is required before broadcast."
                : "An idempotency key prevents repeated submission."}
            </span>
            <button
              type="button"
              className="offer-manager-primary"
              onClick={() => void sendNotification()}
              disabled={
                isSending ||
                (kind === "offer" && !selectedOfferId) ||
                (audience === "individual" && selectedRecipientIds.length === 0)
              }
            >
              {isSending
                ? "Sending…"
                : audience === "all"
                  ? "Review broadcast"
                  : "Send notification"}
            </button>
          </div>
        </section>

        <div
          className="offer-manager-tabs"
          role="tablist"
          aria-label="Offer management views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "offers"}
            className={activeTab === "offers" ? "active" : ""}
            onClick={() => setActiveTab("offers")}
          >
            Offers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={activeTab === "history" ? "active" : ""}
            onClick={() => setActiveTab("history")}
          >
            Notification history
          </button>
        </div>

        {activeTab === "offers" ? (
          <section
            className="offer-manager-panel"
            aria-labelledby="offers-heading"
          >
            <div className="offer-manager-section-heading">
              <div>
                <span className="offer-manager-kicker">
                  CONTENT &amp; DISPATCH
                </span>
                <h2 id="offers-heading">Offers</h2>
              </div>
              <span className="offer-manager-note">
                Editing only saves content; resend is a separate action.
              </span>
            </div>
            {isLoadingOffers ? (
              <div className="offer-manager-empty">Loading offers…</div>
            ) : offers.length === 0 ? (
              <div className="offer-manager-empty">
                <strong>No offers yet</strong>
                <span>Create a draft offer to start.</span>
              </div>
            ) : (
              <div className="offer-manager-offer-list">
                {offers.map((offer) => (
                  <article key={offer._id} className="offer-manager-offer-card">
                    <div className="offer-manager-offer-heading">
                      <div>
                        <span
                          className={`offer-manager-status ${offer.status}`}
                        >
                          {offer.status}
                        </span>
                        <h3>{offer.title}</h3>
                      </div>
                      <span className="offer-manager-destination">
                        {offer.redirectType}: {offer.redirectValue}
                      </span>
                    </div>
                    <p className="offer-manager-offer-message">
                      {offer.message}
                    </p>
                    <div className="offer-manager-meta">
                      <span>Created {formatDate(offer.createdAt)}</span>
                      {offer.publishedAt && (
                        <span>Published {formatDate(offer.publishedAt)}</span>
                      )}
                    </div>
                    {offer.lastDispatch && (
                      <div className="offer-manager-dispatch-summary">
                        <strong>Last dispatch</strong>
                        <span>{offer.lastDispatch.stored} stored</span>
                        <span>
                          {offer.lastDispatch.accepted} Firebase accepted
                        </span>
                        <span>{offer.lastDispatch.failed} failed</span>
                        <span>{offer.lastDispatch.skipped} skipped</span>
                        <time>
                          {formatDate(offer.lastDispatch.completedAt)}
                        </time>
                      </div>
                    )}
                    <div className="offer-manager-actions">
                      <button
                        type="button"
                        onClick={() => openEditOffer(offer)}
                      >
                        Edit content
                      </button>
                      {offer.status === "draft" && (
                        <button
                          type="button"
                          className="primary"
                          disabled={busyOfferId === offer._id}
                          onClick={() =>
                            setConfirmation({ kind: "publish-offer", offer })
                          }
                        >
                          {busyOfferId === offer._id
                            ? "Publishing…"
                            : "Publish & notify"}
                        </button>
                      )}
                      {offer.status === "published" && (
                        <button
                          type="button"
                          className="primary"
                          disabled={busyOfferId === offer._id}
                          onClick={() => void runOfferAction("resend", offer)}
                        >
                          {busyOfferId === offer._id
                            ? "Sending…"
                            : "Resend notification"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger"
                        disabled={busyOfferId === offer._id}
                        onClick={() =>
                          setConfirmation({ kind: "delete-offer", offer })
                        }
                      >
                        Delete offer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Pagination
              currentPage={offerPage}
              totalPages={offerPagination.totalPages}
              totalItems={offerPagination.totalItems}
              onPageChange={setOfferPage}
            />
          </section>
        ) : (
          <section
            className="offer-manager-panel"
            aria-labelledby="history-heading"
          >
            <div className="offer-manager-section-heading">
              <div>
                <span className="offer-manager-kicker">AUDIT TRAIL</span>
                <h2 id="history-heading">Notification history</h2>
              </div>
              <span className="offer-manager-note">
                {isAdmin ? "Admin view includes Admin and Vendor campaigns." : "Vendor view is limited to your campaigns."} Editing saves only; resend is separate.
              </span>
            </div>
            <div className="offer-manager-history-filters" aria-label="Filter notification history">
              <label>Search title or message<input type="search" value={historyFilters.search ?? ""} maxLength={100} onChange={(event) => { setHistoryPage(1); setHistoryFilters((current) => ({ ...current, search: event.target.value })); }} placeholder="Search campaigns" /></label>
              <label>Category<select value={historyFilters.category ?? ""} onChange={(event) => { setHistoryPage(1); setHistoryFilters((current) => ({ ...current, category: event.target.value as NotificationHistoryFilters["category"] })); }}><option value="">All categories</option><option value="offer">Offer</option><option value="announcement">Announcement</option></select></label>
              {isAdmin && <label>Sender role<select value={historyFilters.senderRole ?? ""} onChange={(event) => { setHistoryPage(1); setHistoryFilters((current) => ({ ...current, senderRole: event.target.value as NotificationHistoryFilters["senderRole"] })); }}><option value="">Admin and Vendor</option><option value="admin">Admin</option><option value="vendor">Vendor</option></select></label>}
              <label>Campaign ID<input value={historyFilters.campaignId ?? ""} onChange={(event) => { setHistoryPage(1); setHistoryFilters((current) => ({ ...current, campaignId: event.target.value })); }} placeholder="Filter by ID" /></label>
              <label>From<input type="date" value={historyFilters.from ?? ""} onChange={(event) => { setHistoryPage(1); setHistoryFilters((current) => ({ ...current, from: event.target.value })); }} /></label>
              <label>To<input type="date" value={historyFilters.to ?? ""} onChange={(event) => { setHistoryPage(1); setHistoryFilters((current) => ({ ...current, to: event.target.value })); }} /></label>
              <button type="button" onClick={() => { setHistoryPage(1); setHistoryFilters({}); }}>Clear filters</button>
            </div>
            {isLoadingHistory ? (
              <div className="offer-manager-empty">
                Loading notification history…
              </div>
            ) : historyError ? (
              <div className="offer-manager-empty offer-manager-history-error" role="alert"><strong>Could not load notification history</strong><span>{historyError}</span><button type="button" onClick={() => void loadHistory(historyPage)}>Retry</button></div>
            ) : history.length === 0 ? (
              <div className="offer-manager-empty">
                <strong>No notification history yet</strong>
                <span>
                  Customer-targeted campaigns matching these filters will appear here.
                </span>
              </div>
            ) : (
              <div className="offer-manager-history-list">
                {history.map((notification) => (
                  <article
                    key={notification._id}
                    className="offer-manager-history-card"
                  >
                    <div className="offer-manager-history-content">
                      <div className="offer-manager-offer-heading">
                        <div>
                          <span
                            className={`offer-manager-dispatch-status ${notification.dispatchStatus}`}
                          >
                            {notification.dispatchStatus.replace("_", " ")}
                          </span>
                          <h3>{notification.title}</h3>
                        </div>
                        <time>{formatDate(notification.createdAt)}</time>
                      </div>
                      <p>{notification.message}</p>
                      <div className="offer-manager-meta">
                        <span>{notification.category}</span>
                        <span>Sent by {notification.senderRole} · {notification.sender}</span>
                        <span>{notification.recipientCount} recipient(s)</span>
                        <span>Campaign {notification._id}</span>
                        {notification.relatedId && (
                          <span>{notification.category === "offer" ? "Offer" : "Related resource"} {notification.relatedId}</span>
                        )}
                        <span>{notification.stored} stored</span>
                        <span>{notification.attempted} attempted</span>
                        <span>{notification.accepted} Firebase accepted</span>
                        <span>{notification.failed} failed</span>
                        <span>{notification.skipped} skipped</span>
                      </div>
                    </div>
                    <div className="offer-manager-history-actions">
                      <button type="button" disabled={Boolean(busyNotificationId) || isSavingNotification} onClick={() => { setEditingNotification(notification); setNotificationEditTitle(notification.title); setNotificationEditMessage(notification.message); setError(""); }}>Edit campaign</button>
                      <button type="button" disabled={Boolean(busyNotificationId) || isSavingNotification} onClick={() => setConfirmation({ kind: "resend-notification", notification })}>Resend campaign</button>
                      <button type="button" className="danger" disabled={Boolean(busyNotificationId) || isSavingNotification} onClick={() => setConfirmation({ kind: "delete-notification", notification })}>{busyNotificationId === notification._id ? "Working…" : "Hide history"}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Pagination
              currentPage={historyPage}
              totalPages={historyPagination.totalPages}
              totalItems={historyPagination.totalItems}
              onPageChange={setHistoryPage}
            />
          </section>
        )}
      </div>

      {isOfferFormOpen && (
        <div
          className="offer-manager-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingOffer)
              setIsOfferFormOpen(false);
          }}
        >
          <form
            className="offer-manager-modal"
            onSubmit={(event) => void saveOffer(event)}
          >
            <header>
              <div>
                <span className="offer-manager-kicker">
                  {editingOffer ? "CONTENT EDIT" : "NEW DRAFT"}
                </span>
                <h2>
                  {editingOffer
                    ? "Edit offer notification"
                    : "Create offer draft"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setIsOfferFormOpen(false)}
                disabled={isSavingOffer}
              >
                ×
              </button>
            </header>
            {editingOffer && (
              <p className="offer-manager-modal-note">
                Saving updates the stored title and message only. It will not
                send a push notification.
              </p>
            )}
            <label>
              Title
              <input
                required
                minLength={1}
                maxLength={120}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </label>
            <label>
              Message
              <textarea
                required
                minLength={1}
                maxLength={240}
                value={draft.message}
                onChange={(event) =>
                  setDraft({ ...draft, message: event.target.value })
                }
              />
            </label>
            {!editingOffer && (
              <>
                <label>
                  Destination type
                  <select
                    value={draft.redirectType}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        redirectType: event.target.value as OfferRedirectType,
                      })
                    }
                  >
                    <option value="category">Category</option>
                    <option value="product">Product</option>
                  </select>
                </label>
                <label>
                  Destination ID
                  <input
                    required
                    maxLength={120}
                    value={draft.redirectValue}
                    onChange={(event) =>
                      setDraft({ ...draft, redirectValue: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            <footer>
              <button
                type="button"
                onClick={() => setIsOfferFormOpen(false)}
                disabled={isSavingOffer}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={isSavingOffer}
              >
                {isSavingOffer
                  ? "Saving…"
                  : editingOffer
                    ? "Save content only"
                    : "Create draft"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {editingNotification && (
        <div className="offer-manager-overlay" role="presentation">
          <form className="offer-manager-modal" onSubmit={(event) => void saveNotificationCampaign(event)}>
            <header>
              <div><span className="offer-manager-kicker">CAMPAIGN CONTENT</span><h2>Edit customer notification</h2></div>
              <button type="button" aria-label="Close" onClick={() => setEditingNotification(null)} disabled={isSavingNotification}>×</button>
            </header>
            <p className="offer-manager-modal-note">This updates the title and message for all campaign recipients. Saving does not send a push; use Resend campaign separately.</p>
            <label>Title<input required minLength={1} maxLength={120} value={notificationEditTitle} onChange={(event) => setNotificationEditTitle(event.target.value)} /></label>
            <label>Message<textarea required minLength={1} maxLength={240} value={notificationEditMessage} onChange={(event) => setNotificationEditMessage(event.target.value)} /></label>
            <footer>
              <button type="button" onClick={() => setEditingNotification(null)} disabled={isSavingNotification}>Cancel</button>
              <button type="submit" className="primary" disabled={isSavingNotification}>{isSavingNotification ? "Saving…" : "Save content only"}</button>
            </footer>
          </form>
        </div>
      )}

      {confirmation && (
        <div className="offer-manager-overlay" role="presentation">
          <section
            className="offer-manager-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="offer-confirm-title"
            aria-describedby="offer-confirm-description"
          >
            <span className="offer-manager-kicker">CONFIRM ACTION</span>
            <h2 id="offer-confirm-title">
              {confirmation.kind === "broadcast"
                ? "Send to all customer accounts?"
                : confirmation.kind === "delete-notification"
                  ? "Hide this campaign history?"
                  : confirmation.kind === "resend-notification"
                    ? "Resend this campaign?"
                    : confirmation.kind === "delete-offer"
                      ? "Delete this offer?"
                      : "Publish and notify customers?"}
            </h2>
            <p id="offer-confirm-description">
              {confirmation.kind === "broadcast"
                ? "This offer notification will be sent to all customer accounts. Admin and vendor accounts are excluded."
                : confirmation.kind === "delete-notification"
                  ? "This hides all recipient history rows for this campaign. It does not delete a related offer or order, and a delivered push cannot be recalled."
                  : confirmation.kind === "resend-notification"
                    ? `This sends the saved campaign content to its ${confirmation.notification.recipientCount} saved recipient(s). Firebase may accept or reject each device attempt.`
                    : confirmation.kind === "delete-offer"
                      ? "The offer will be soft-deleted and cannot be resent. Historical notification records and orders are retained."
                      : "Publishing sends a notification to customer accounts. This action cannot be undone."}
            </p>
            {error && (
              <div className="offer-manager-alert error" role="alert">
                {error}
              </div>
            )}
            <footer>
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                disabled={isConfirming}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  confirmation.kind.startsWith("delete")
                    ? "danger-fill"
                    : "primary"
                }
                onClick={() => void confirmAction()}
                disabled={isConfirming}
              >
                {isConfirming
                  ? "Please wait…"
                  : confirmation.kind === "broadcast"
                    ? "Send broadcast"
                    : confirmation.kind === "delete-notification"
                      ? "Hide history"
                      : confirmation.kind === "resend-notification"
                        ? "Resend campaign"
                        : confirmation.kind === "delete-offer"
                          ? "Delete offer"
                          : "Publish offer"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

export default OfferNotificationManager;
