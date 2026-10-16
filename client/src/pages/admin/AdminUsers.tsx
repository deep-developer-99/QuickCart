import { useEffect, useState } from "react";
import axios from "axios";

import { getAdminUsers } from "../../services/adminService";
import Pagination from "../../components/common/Pagination";

import "./AdminUsers.css";

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  googleId?: string;
  role: "user";
  createdAt: string;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchUsers = async (requestedPage = page) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminUsers(requestedPage, 10);

      if (response?.success) {
        setUsers(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        if (requestedPage > (response.pagination?.totalPages || 1)) setPage(response.pagination?.totalPages || 1);
        setTotalItems(response.pagination?.totalItems || 0);
      } else {
        setError("Failed to load users.");
      }
    } catch (error: unknown) {
      console.error("Get users error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to load users.");
      } else {
        setError("Failed to load users.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  if (isLoading) {
    return (
      <div className="admin-users-page">
        <div className="admin-users-loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="admin-users-page">
      <div className="admin-users-container">
        <div className="admin-page-header">
          <div>
            <h1>Manage Users</h1>
            <p>View all registered QuickCart users.</p>
          </div>

          <div className="admin-count">
            {totalItems} {totalItems === 1 ? "User" : "Users"}
          </div>
        </div>

        {error && <div className="admin-page-error">{error}</div>}

        {users.length === 0 ? (
          <div className="admin-empty">
            <div>👥</div>
            <h3>No Users Found</h3>
            <p>There are no registered users yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Login Method</th>
                  <th>Joined</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <div className="user-info">
                        {user.profileImage ? (
                          <img
                            src={user.profileImage}
                            alt={user.name}
                            className="user-avatar"
                          />
                        ) : (
                          <div className="user-avatar-placeholder">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <strong>{user.name}</strong>
                          <span>{user.role}</span>
                        </div>
                      </div>
                    </td>

                    <td>{user.email || "N/A"}</td>

                    <td>{user.phone || "N/A"}</td>

                    <td>
                      <span className="method-badge">
                        {user.googleId ? "Google" : "Phone"}
                      </span>
                    </td>

                    <td>
                      {new Date(user.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default AdminUsers;
