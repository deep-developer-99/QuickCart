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
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;

    setName(user.name);
    setPhone(user.phone || "");
    setProfileImagePreview(user.profileImage || "");
  }, [user]);

  if (!user) {
    return <div className="profile-message">Loading profile...</div>;
  }

  const handleEdit = () => {
    setName(user.name);
    setPhone(user.phone || "");
    setProfileImageFile(null);
    setProfileImagePreview(user.profileImage || "");
    setError("");
    setSuccess("");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setName(user.name);
    setPhone(user.phone || "");
    setProfileImageFile(null);
    setProfileImagePreview(user.profileImage || "");
    setError("");
    setSuccess("");
    setIsEditing(false);
  };

  const handleProfileImageChange = (file: File | null) => {
    setError("");

    if (!file) {
      setProfileImageFile(null);
      setProfileImagePreview(user.profileImage || "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile picture must be 5 MB or smaller.");
      return;
    }

    setProfileImageFile(file);
    setProfileImagePreview(URL.createObjectURL(file));
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
        profileImage: profileImageFile || undefined,
      });

      if (!response?.success || !response?.data) {
        setError(response?.message || "Failed to update profile.");
        return;
      }

      dispatch(setCredentials(response.data));
      setSuccess("Profile updated successfully.");
      setIsEditing(false);
    } catch (error: unknown) {
      console.error("Update profile error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to update profile.");
      } else {
        setError("Failed to update profile.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-heading">
          <p>QUICKCART</p>
          <h1>My Profile</h1>
        </div>

        <div className="profile-card">
          <div className="profile-avatar-wrapper">
            {profileImagePreview ? (
              <img
                src={profileImagePreview}
                alt={user.name}
                className="profile-avatar-image"
              />
            ) : (
              <div className="profile-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}

            {isEditing && (
              <label className="profile-image-upload">
                Change Photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(event) =>
                    handleProfileImageChange(event.target.files?.[0] || null)
                  }
                />
              </label>
            )}
          </div>

          <div className="profile-info">
            {error && <div className="profile-alert error">{error}</div>}

            {success && <div className="profile-alert success">{success}</div>}

            <div className="profile-field">
              <span>Name</span>
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  maxLength={60}
                />
              ) : (
                <strong>{user.name}</strong>
              )}
            </div>

            <div className="profile-field">
              <span>Email</span>
              <strong>{user.email || "Not provided"}</strong>
            </div>

            <div className="profile-field">
              <span>Phone</span>
              {isEditing ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Enter your phone number"
                  maxLength={15}
                />
              ) : (
                <strong>{user.phone || "Not provided"}</strong>
              )}
            </div>

            <div className="profile-field">
              <span>Account Type</span>
              <strong>User</strong>
            </div>

            <div className="profile-actions">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="profile-button secondary"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="profile-button primary"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="profile-button primary"
                  onClick={handleEdit}
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
