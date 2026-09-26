export type UserRole = "user" | "vendor" | "admin";

export interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  googleId?: string;
  role: "user";
}

export interface Vendor {
  _id: string;
  name: string;
  email: string;
  shopName: string;
  phone?: string;
  address?: string;
  isApproved: boolean;
  isActive: boolean;
  status: "pending" | "approved" | "rejected";
  role: "vendor";
}

export interface Admin {
  _id: string;
  name: string;
  email: string;
  role: "admin";
  isActive: boolean;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  shopName?: string;
}
