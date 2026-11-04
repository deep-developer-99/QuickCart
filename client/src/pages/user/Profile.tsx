import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import axios from "axios";
import {
  FaCamera,
  FaCheck,
  FaInfoCircle,
  FaPencilAlt,
  FaTimes,
} from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import { updateProfile } from "../../services/authService";
import { setCredentials } from "../../store/slice/authSlice";

import "./Profile.css";

const Profile = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [failedProfileImage, setFailedProfileImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  const handlePhotoSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setSuccess("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Choose a JPG, PNG or WEBP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Choose an image smaller than 2 MB.");
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const response = await updateProfile({
        name: user.name,
        phone: user.phone || undefined,
        profileImage: file,
      });

      if (!response?.success || !response?.data) {
        setError(response?.message || "Failed to update profile picture.");
        return;
      }

      dispatch(setCredentials(response.data));
      setFailedProfileImage(null);
      setSuccess("Profile picture updated successfully.");
    } catch (requestError: unknown) {
      console.error("Profile picture update error:", requestError);
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message ||
              "Failed to update profile picture."
          : "Failed to update profile picture.",
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const initial = user.name.charAt(0).toUpperCase();
  const accountId = user.id || user._id;
  const updatedAt = user.updatedAt ? new Date(user.updatedAt) : null;
  const formattedUpdatedAt =
    updatedAt && Number.isFinite(updatedAt.getTime())
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(updatedAt)
      : null;

  return (
    <section className="account-section profile-section">
      <header className="profile-overview-heading">
        <div>
          <h1>Personal Information</h1>
          <p>
            Your registered personal and verification credentials are shown
            below.
          </p>
        </div>
        <span className="profile-active-badge">
          <FaCheck aria-hidden="true" /> Active User
        </span>
      </header>

      {accountId && (
        <p className="profile-account-id">
          <span>ACCOUNT ID</span>
          <code>{accountId}</code>
        </p>
      )}

      <div className="profile-heading-divider" />
      {error && <div className="profile-alert error" role="alert">{error}</div>}
      {success && <div className="profile-alert success" role="status">{success}</div>}

      <div className="profile-picture-card">
        <div className="profile-picture-avatar-wrap">
          {user.profileImage && failedProfileImage !== user.profileImage ? (
            <img
              className="profile-large-avatar"
              src={user.profileImage}
              alt={`${user.name} profile`}
              onError={() => setFailedProfileImage(user.profileImage || null)}
            />
          ) : (
            <div className="profile-large-avatar profile-large-avatar-fallback" aria-hidden="true">
              {initial}
            </div>
          )}
          <span className="profile-camera-mark" aria-hidden="true">
            <FaCamera />
          </span>
        </div>

        <div className="profile-picture-copy">
          <span className="profile-field-label">PROFILE PICTURE</span>
          <strong>Avatar</strong>
          <small>JPG, PNG or WEBP under 2 MB recommended.</small>
        </div>

        <div className="profile-photo-action">
          <input
            ref={photoInputRef}
            className="profile-photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={handlePhotoSelected}
            aria-label="Choose a profile picture"
          />
          <button
            type="button"
            className="profile-photo-button"
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploadingPhoto || isSaving}
            aria-busy={isUploadingPhoto}
          >
            <FaCamera aria-hidden="true" />
            {isUploadingPhoto ? "Uploading..." : "Update Photo"}
          </button>
        </div>
      </div>

      <div className="profile-fields-list">
        <div className="profile-detail-field">
          <span className="profile-field-label">FULL NAME</span>
          {isEditing ? (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder="Enter your name"
              autoComplete="name"
            />
          ) : (
            <strong>{user.name}</strong>
          )}
        </div>

        <div className="profile-detail-field">
          <span className="profile-field-label">EMAIL ADDRESS</span>
          <div className="profile-detail-value-line">
            <strong>{user.email || "Not provided"}</strong>
          </div>
          <small>Email cannot be changed directly.</small>
        </div>

        <div className="profile-detail-field">
          <span className="profile-field-label">PHONE NUMBER</span>
          {isEditing ? (
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={16}
              placeholder="Enter your phone number"
              autoComplete="tel"
            />
          ) : (
            <strong>{user.phone || "Not provided"}</strong>
          )}
        </div>

        <div className="profile-detail-field profile-account-type-field">
          <span className="profile-field-label">ACCOUNT TYPE</span>
          <strong className="account-type-value">
            <i aria-hidden="true" /> User <span>(Standard Buyer)</span>
          </strong>
        </div>
      </div>

      <div className="profile-bottom-divider" />
      <footer className="profile-bottom-actions">
        <div className="profile-updated-info">
          {formattedUpdatedAt && (
            <>
              <FaInfoCircle aria-hidden="true" />
              <span>Last profile update: {formattedUpdatedAt}</span>
            </>
          )}
        </div>
        <div className="profile-edit-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="profile-cancel-button"
                onClick={handleCancel}
                disabled={isSaving || isUploadingPhoto}
              >
                <FaTimes aria-hidden="true" /> Cancel
              </button>
              <button
                type="button"
                className="profile-save-button"
                onClick={handleSave}
                disabled={isSaving || isUploadingPhoto}
              >
                <FaCheck aria-hidden="true" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="profile-edit-button"
              onClick={handleEdit}
              disabled={isUploadingPhoto}
            >
              <FaPencilAlt aria-hidden="true" /> Edit Profile
            </button>
          )}
        </div>
      </footer>
    </section>
  );
};

export default Profile;
