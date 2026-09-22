import { Response } from "express";

const clients = new Map<string, Set<Response>>();

const getRoomKey = (role: string, userId: string) => `${role}:${userId}`;

export const addNotificationClient = (
  role: "admin" | "vendor",
  userId: string,
  res: Response,
) => {
  const key = getRoomKey(role, userId);
  const room = clients.get(key) ?? new Set<Response>();

  room.add(res);
  clients.set(key, room);

  res.on("close", () => {
    room.delete(res);
    if (room.size === 0) {
      clients.delete(key);
    }
  });
};

export const emitNotification = (
  role: "admin" | "vendor",
  userId: string,
  notification: unknown,
) => {
  const room = clients.get(getRoomKey(role, userId));

  if (!room) return;

  const payload = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;

  for (const client of room) {
    try {
      client.write(payload);
    } catch (error) {
      console.error("Failed to send notification event:", error);
      room.delete(client);
    }
  }
};
