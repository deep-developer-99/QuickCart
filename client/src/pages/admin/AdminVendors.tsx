import { useEffect, useState } from "react";
import axios from "axios";

import {
  getAdminVendors,
  approveVendor,
  rejectVendor,
  deactivateVendor,
  activateVendor,
} from "../../services/adminService";

import "./AdminVendors.css";

interface AdminVendor {
  _id: string;
  name: string;
  email: string;
  shopName: string;
  phone?: string;
  address?: string;
  isApproved: boolean;
  isActive: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const AdminVendors = () => {
  const [vendors, setVendors] = useState<AdminVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminVendors();

      if (response?.success) {
        setVendors(response.data || []);
      } else {
        setError("Failed to load vendors");
      }
    } catch (error: unknown) {
      console.error("Get vendors error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to load vendors");
      } else {
        setError("Failed to load vendors.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleAction = async (
    id: string,
    action: "approve" | "reject" | "activate" | "deactivate",
  ) => {
    try {
      setProcessingId(id);
      setError("");
      setSuccess("");

      let response;

      if (action === "approve") {
        response = await approveVendor(id);
      } else if (action === "reject") {
        response = await rejectVendor(id);
      } else if (action === "activate") {
        response = await activateVendor(id);
      } else {
        response = await deactivateVendor(id);
      }

      if (response?.success) {
        setSuccess(response.message || "Vendor updated successfully.");
        await fetchVendors();
      }
    } catch (error: unknown) {
      console.error("Vendor action error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to update vendor.");
      } else {
        setError("Failed to update vendor.");
      }
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-vendors-page">
        <div className="admin-vendors-loading">Loading vendors...</div>
      </div>
    );
  }

  return (
    <div className="admin-vendors-page">
      <div className="admin-vendors-container">
        <div className="admin-page-header">
          <div>
            <h1>Manage Vendors</h1>
            <p>Approve and manage QuickCart vendors.</p>
          </div>

          <div className="admin-count">
            {vendors.length} {vendors.length === 1 ? "Vendor" : "Vendors"}
          </div>
        </div>

        {error && <div className="admin-page-error">{error}</div>}

        {success && <div className="admin-page-success">{success}</div>}

        {vendors.length === 0 ? (
          <div className="admin-empty">
            <div>🏪</div>
            <h3>No Vendors Found</h3>
            <p>There are no registered vendors yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Shop</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Account</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor._id}>
                    <td>
                      <strong>{vendor.name}</strong>
                      <span className="table-subtext">{vendor.email}</span>
                    </td>

                    <td>{vendor.shopName}</td>

                    <td>
                      <div>{vendor.phone || "N/A"}</div>
                      <span className="table-subtext">
                        {vendor.address || "No address"}
                      </span>
                    </td>

                    <td>
                      <span className={`status-badge status-${vendor.status}`}>
                        {vendor.status}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`account-badge ${
                          vendor.isActive ? "active" : "inactive"
                        }`}
                      >
                        {vendor.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="vendor-actions">
                        {vendor.status === "pending" && (
                          <>
                            <button
                              type="button"
                              className="approve-button"
                              disabled={processingId === vendor._id}
                              onClick={() =>
                                handleAction(vendor._id, "approve")
                              }
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              className="reject-button"
                              disabled={processingId === vendor._id}
                              onClick={() => handleAction(vendor._id, "reject")}
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {vendor.status === "rejected" && (
                          <button
                            type="button"
                            className="approve-button"
                            disabled={processingId === vendor._id}
                            onClick={() => handleAction(vendor._id, "approve")}
                          >
                            Approve
                          </button>
                        )}

                        {vendor.isActive ? (
                          <button
                            type="button"
                            className="deactivate-button"
                            disabled={processingId === vendor._id}
                            onClick={() =>
                              handleAction(vendor._id, "deactivate")
                            }
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="activate-button"
                            disabled={processingId === vendor._id}
                            onClick={() => handleAction(vendor._id, "activate")}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVendors;
