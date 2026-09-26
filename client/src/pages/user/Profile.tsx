import { useEffect, useState } from "react";
import axios from "axios";

import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import { updateProfile } from "../../services/authService";
import { setCredentials } from "../../store/slice/authSlice";

import "./Profile.css";

const Profile = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone || "");
  }, [user]);

  if (!user) {
    return <div className="account-section-message">Loading profile...</div>;
  }

  const handleEdit = () => {
    setName(user.name);
    setPhone(user.phone || "");
    setError("");
    setSuccess("");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setName(user.name);
    setPhone(user.phone || "");
    setError("");
    setSuccess("");
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");

      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();

      if (!trimmedName) {
        setError("Name is required.");
        return;
      }

      if (trimmedName.length < 2) {
        setError("Name must be at least 2 characters long.");
        return;
      }

      if (trimmedPhone && !/^\+?[0-9]{10,15}$/.test(trimmedPhone)) {
        setError("Please enter a valid phone number.");
        return;
      }

      setIsSaving(true);
      const response = await updateProfile({
        name: trimmedName,
        phone: trimmedPhone || undefined,
      });

      if (!response?.success || !response?.data) {
        setError(response?.message || "Failed to update profile.");
        return;
      }

      dispatch(setCredentials(response.data));
      setSuccess("Profile updated successfully.");
      setIsEditing(false);
    } catch (requestError: unknown) {
      console.error("Update profile error:", requestError);
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message || "Failed to update profile."
          : "Failed to update profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <section className="account-section profile-section">
      <div className="account-section-header">
        <div>
          <p className="account-eyebrow">MY ACCOUNT</p>
          <h1>My Profile</h1>
          <p className="account-section-subtitle">
            View and manage your personal QuickCart information.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            className="account-outline-button"
            onClick={handleEdit}
          >
            ✎ Edit Profile
          </button>
        )}
      </div>

      {error && <div className="profile-alert error">{error}</div>}
      {success && <div className="profile-alert success">{success}</div>}

      <div className="profile-information-card">
        <div className="profile-information-heading">
          <div>
            <h2>Personal Information</h2>
            <p>Your account details are shown below.</p>
          </div>
          <span className="profile-account-badge">USER ACCOUNT</span>
        </div>

        <div className="profile-information-body">
          <div className="profile-picture-column">
            <div className="profile-large-avatar">{initial}</div>
            <span>Profile Picture</span>
          </div>

          <div className="profile-fields-grid">
            <div className="profile-detail-field">
              <span>Full Name</span>
              {isEditing ? (
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  placeholder="Enter your name"
                />
              ) : (
                <strong>{user.name}</strong>
              )}
            </div>

            <div className="profile-detail-field">
              <span>Email Address</span>
              <strong>{user.email || "Not provided"}</strong>
              <small>Email cannot be changed here.</small>
            </div>

            <div className="profile-detail-field">
              <span>Phone Number</span>
              {isEditing ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={15}
                  placeholder="Enter your phone number"
                />
              ) : (
                <strong>{user.phone || "Not provided"}</strong>
              )}
            </div>

            <div className="profile-detail-field">
              <span>Account Type</span>
              <strong className="account-type-value">
                <i /> User
              </strong>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="profile-edit-actions">
            <button
              type="button"
              className="profile-cancel-button"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="profile-save-button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default Profile;
