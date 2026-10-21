import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import {
  createAdminOffer,
  getAdminOffers,
  publishAdminOffer,
  updateAdminOffer,
} from "../../services/offerService";
import type { Offer, OfferRedirectType } from "../../types/offer";
import Pagination from "../../components/common/Pagination";

import "./AdminOffers.css";

interface OfferFormState {
  title: string;
  message: string;
  redirectType: OfferRedirectType;
  redirectValue: string;
}

const initialForm: OfferFormState = {
  title: "",
  message: "",
  redirectType: "category",
  redirectValue: "",
};

const AdminOffers = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadOffers = useCallback(async (requestedPage: number) => {
    try {
      setIsLoading(true);
      const result = await getAdminOffers(requestedPage);
      setOffers(result.data || []);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalItems(result.pagination?.totalItems || 0);
    } catch (requestError: unknown) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Failed to load offers" : "Failed to load offers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOffers(page);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOffers, page]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
    setError("");
    setIsFormOpen(true);
  };

  const openEdit = (offer: Offer) => {
    setEditingId(offer._id);
    setForm({ title: offer.title, message: offer.message, redirectType: offer.redirectType, redirectValue: offer.redirectValue });
    setMessage("");
    setError("");
    setIsFormOpen(true);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError("");
      if (editingId) {
        await updateAdminOffer(editingId, form);
        setMessage("Offer updated successfully.");
      } else {
        await createAdminOffer(form);
        setMessage("Offer draft created successfully.");
      }
      setIsFormOpen(false);
      await loadOffers(page);
    } catch (requestError: unknown) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Failed to save offer" : "Failed to save offer");
    } finally {
      setIsSaving(false);
    }
  };

  const publish = async (id: string) => {
    try {
      setError("");
      await publishAdminOffer(id);
      setMessage("Offer published. Customer push dispatch started in the background.");
      await loadOffers(page);
    } catch (requestError: unknown) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Failed to publish offer" : "Failed to publish offer");
    }
  };

  return (
    <div className="admin-offers-page">
      <div className="admin-offers-container">
        <header className="admin-offers-header">
          <div><span className="admin-offers-eyebrow">PROMOTIONS</span><h1>Manage Offers</h1><p>Create drafts and publish them when ready. Publishing sends eligible customers a push notification.</p></div>
          <button type="button" className="admin-offer-primary" onClick={openCreate}>Create offer</button>
        </header>
        {message && <div className="admin-offer-message success">{message}</div>}
        {error && <div className="admin-offer-message error">{error}</div>}
        {isLoading ? <div className="admin-offers-empty">Loading offers...</div> : offers.length === 0 ? (
          <div className="admin-offers-empty"><h2>No offers yet</h2><p>Create an offer draft to begin.</p></div>
        ) : (
          <div className="admin-offers-list">
            {offers.map((offer) => <article className="admin-offer-card" key={offer._id}>
              <div className="admin-offer-card-header"><div><span className={`admin-offer-status ${offer.status}`}>{offer.status}</span><h2>{offer.title}</h2></div><span className="admin-offer-destination">{offer.redirectType}: {offer.redirectValue}</span></div>
              <p>{offer.message}</p>
              <div className="admin-offer-actions"><button type="button" onClick={() => openEdit(offer)}>Edit</button>{offer.status === "draft" && <button type="button" className="publish" onClick={() => void publish(offer._id)}>Publish</button>}</div>
            </article>)}
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
      </div>
      {isFormOpen && <div className="admin-offer-modal-overlay"><form className="admin-offer-form" onSubmit={(event) => void submit(event)}>
        <div className="admin-offer-form-header"><h2>{editingId ? "Edit offer" : "Create offer draft"}</h2><button type="button" onClick={() => setIsFormOpen(false)}>×</button></div>
        <label>Title<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Message<textarea required maxLength={240} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
        <label>Destination<select value={form.redirectType} onChange={(event) => setForm({ ...form, redirectType: event.target.value as OfferRedirectType })}><option value="category">Category</option><option value="product">Product</option></select></label>
        <label>Destination ID<input required maxLength={120} value={form.redirectValue} onChange={(event) => setForm({ ...form, redirectValue: event.target.value })} /></label>
        <div className="admin-offer-form-actions"><button type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button type="submit" className="publish" disabled={isSaving}>{isSaving ? "Saving..." : "Save draft"}</button></div>
      </form></div>}
    </div>
  );
};

export default AdminOffers;
