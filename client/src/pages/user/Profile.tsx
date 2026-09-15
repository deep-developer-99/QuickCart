import { useAppSelector } from "../../hooks/reduxHooks";

import "./Profile.css";

const Profile = () => {
  const { user } = useAppSelector((state) => state.auth);

  if (!user) {
    return <div className="profile-message">Loading profile...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-heading">
          <p>QUICKCART</p>
          <h1>My Profile</h1>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div className="profile-info">
            <div className="profile-field">
              <span>Name</span>
              <strong>{user.name}</strong>
            </div>

            <div className="profile-field">
              <span>Email</span>
              <strong>{user.email || "Not provided"}</strong>
            </div>

            <div className="profile-field">
              <span>Phone</span>
              <strong>{user.phone || "Not provided"}</strong>
            </div>

            <div className="profile-field">
              <span>Account Type</span>
              <strong>User</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
