import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../hooks/reduxHooks";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../services/notificationService";
import type { Notification } from "../../types/notification";
import "./NotificationBell.css";

const NotificationBell = () => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<Notification | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "vendor")) {
      return;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const data = await getNotifications();
        if (isMounted) {
          setNotifications(data);
        }
      } catch (error) {
        console.error("Failed to load notifications:", error);
      }
    };

    loadNotifications();

    if (!apiUrl) {
      console.error("VITE_API_URL is missing");
      return () => {
        isMounted = false;
      };
    }

    const eventSource = new EventSource(`${apiUrl}/notifications/stream`, {
      withCredentials: true,
    });

    const handleNotification = (event: MessageEvent<string>) => {
      try {
        const notification = JSON.parse(event.data) as Notification;

        if (!isMounted) return;

        setNotifications((previous) => [
          notification,
          ...previous.filter((item) => item._id !== notification._id),
        ]);
        setToast(notification);

        window.setTimeout(() => {
          setToast((current) =>
            current?._id === notification._id ? null : current,
          );
        }, 5000);
      } catch (error) {
        console.error("Invalid notification event:", error);
      }
    };

    eventSource.addEventListener("notification", handleNotification);

    eventSource.onerror = () => {
      // EventSource automatically retries the connection.
    };

    return () => {
      isMounted = false;
      eventSource.close();
    };
  }, [apiUrl, user]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (!user || (user.role !== "admin" && user.role !== "vendor")) {
    return null;
  }

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification._id);
        setNotifications((previous) =>
          previous.map((item) =>
            item._id === notification._id ? { ...item, isRead: true } : item,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }

    setIsOpen(false);

    if (notification.type === "NEW_ORDER") {
      navigate("/vendor/orders");
    } else if (notification.type === "NEW_VENDOR") {
      navigate("/admin/vendors");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          isRead: true,
        })),
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  return (
    <>
      <div className="notification-bell-container" ref={containerRef}>
        <button
          type="button"
          className="notification-bell-button"
          aria-label="Notifications"
          onClick={() => setIsOpen((previous) => !previous)}
        >
          <span className="notification-bell-icon">🔔</span>
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="notification-dropdown">
            <div className="notification-header">
              <div>
                <h3>Notifications</h3>
                <span>{unreadCount} unread</span>
              </div>

              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead}>
                  Mark all read
                </button>
              )}
            </div>

            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <span>🔕</span>
                  <p>No notifications yet.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    type="button"
                    className={`notification-item ${
                      notification.isRead ? "read" : "unread"
                    }`}
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <span className="notification-item-icon">
                      {notification.type === "NEW_ORDER" ? "🛒" : "🏪"}
                    </span>
                    <span className="notification-item-content">
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <small>
                        {new Date(notification.createdAt).toLocaleString()}
                      </small>
                    </span>
                    {!notification.isRead && (
                      <span className="notification-unread-dot" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <button
          type="button"
          className="notification-toast"
          onClick={() => handleNotificationClick(toast)}
        >
          <span className="notification-toast-icon">
            {toast.type === "NEW_ORDER" ? "🛒" : "🏪"}
          </span>
          <span>
            <strong>{toast.title}</strong>
            <small>{toast.message}</small>
          </span>
        </button>
      )}
    </>
  );
};

export default NotificationBell;
