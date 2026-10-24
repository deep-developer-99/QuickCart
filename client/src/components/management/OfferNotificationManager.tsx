import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";

import Pagination from "../common/Pagination";
import {
  createManagedOffer,
  deleteManagedNotification,
  deleteManagedOffer,
  getEligibleRecipients,
  getManagedNotificationHistory,
  getManagedOffers,
  publishManagedOffer,
  resendOfferNotification,
  sendManagedNotification,
  updateOfferContent,
} from "../../services/notificationManagementService";
import type {
  CustomerRecipient,
  ManagedNotification,
  ManagedOffer,
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
  const [recipients, setRecipients] = useState<CustomerRecipient[]>([]);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientPagination, setRecipientPagination] = useState(
    pageInfo(1, 20),
  );
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] =
    useState<CustomerRecipient | null>(null);
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sendIdempotencyRef = useRef<{ signature: string; key: string } | null>(
    null,
  );
  const resendIdempotencyRef = useRef(new Map<string, string>());

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
      const response = await getManagedNotificationHistory(page, 20);
      setHistory(response.data ?? []);
      setHistoryPagination(response.pagination ?? pageInfo(page, 20));
      if (page > (response.pagination?.totalPages ?? 1))
        setHistoryPage(response.pagination?.totalPages ?? 1);
    } catch (requestError) {
      setError(
        getRequestError(requestError, "Could not load notification history."),
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

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
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, historyPage, loadHistory]);

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
    if (isSending) return;
    if (audience === "individual" && !selectedRecipient) {
      setError("Choose an eligible customer first.");
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
    if (isSending) return false;
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
              ...(audience === "individual" && selectedRecipient
                ? { customerId: selectedRecipient._id }
                : {}),
            } as const)
          : ({
              audience: "individual",
              kind: "custom",
              category: "general",
              customerId: selectedRecipient!._id,
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
        `Saved for ${result.data.stored} customer(s). Firebase accepted ${result.data.accepted}; failed ${result.data.failed}; skipped ${result.data.skipped}.`,
      );
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
      setSuccess(
        "History entry hidden. A push already delivered to a phone cannot be recalled.",
      );
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
                <option value="individual">One customer</option>
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
                {selectedRecipient && (
                  <div className="offer-manager-selected-recipient">
                    Selected: <strong>{selectedRecipient.name}</strong>
                    {selectedRecipient.email
                      ? ` · ${selectedRecipient.email}`
                      : ""}
                  </div>
                )}
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
                    recipients.map((recipient) => (
                      <button
                        type="button"
                        key={recipient._id}
                        className={`offer-manager-recipient${selectedRecipient?._id === recipient._id ? " selected" : ""}`}
                        onClick={() => setSelectedRecipient(recipient)}
                      >
                        <span>
                          <strong>{recipient.name}</strong>
                          <small>
                            {recipient.email || recipient.phone || "Customer"}
                          </small>
                        </span>
                        <span>
                          {selectedRecipient?._id === recipient._id
                            ? "Selected"
                            : "Select"}
                        </span>
                      </button>
                    ))
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
              disabled={isSending || (kind === "offer" && !selectedOfferId)}
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
                Delete history hides the record; it does not delete an offer.
              </span>
            </div>
            {isLoadingHistory ? (
              <div className="offer-manager-empty">
                Loading notification history…
              </div>
            ) : history.length === 0 ? (
              <div className="offer-manager-empty">
                <strong>No notification history yet</strong>
                <span>
                  Sent notifications and offer dispatches will appear here.
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
                        <span>
                          {notification.category || notification.type}
                        </span>
                        {notification.relatedId && (
                          <span>Offer {notification.relatedId}</span>
                        )}
                        <span>{notification.acceptedCount} accepted</span>
                        <span>{notification.failedCount} failed</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="danger"
                      disabled={busyNotificationId === notification._id}
                      onClick={() =>
                        setConfirmation({
                          kind: "delete-notification",
                          notification,
                        })
                      }
                    >
                      {busyNotificationId === notification._id
                        ? "Deleting…"
                        : "Delete history"}
                    </button>
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
                  ? "Delete this history entry?"
                  : confirmation.kind === "delete-offer"
                    ? "Delete this offer?"
                    : "Publish and notify customers?"}
            </h2>
            <p id="offer-confirm-description">
              {confirmation.kind === "broadcast"
                ? "This offer notification will be sent to all customer accounts. Admin and vendor accounts are excluded."
                : confirmation.kind === "delete-notification"
                  ? "This hides the managed history record. It does not delete its offer, and a delivered push cannot be recalled."
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
