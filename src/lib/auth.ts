import type { User } from "@/services/user-service";

export type UserRole = "admin" | "accountant" | "cs" | null;

/**
 * Lấy role của user (từ user object trực tiếp)
 */
export const getUserRole = (user: User | null): UserRole => {
  if (!user) return null;
  return (user.role as UserRole) || null;
};

/**
 * Kiểm tra user có phải admin không
 */
export const isAdmin = (user: User | null): boolean => {
  return user?.role === "admin";
};

/**
 * Kiểm tra user có phải accountant không
 */
export const isAccountant = (user: User | null): boolean => {
  return user?.role === "accountant" || user?.role === "admin"; // Admin cũng có quyền accountant
};

/**
 * Kiểm tra user có phải cs không
 */
export const isCs = (user: User | null): boolean => {
  return user?.role === "cs" || user?.role === "admin"; // Admin cũng có quyền cs
};

/**
 * Kiểm tra user có quyền truy cập route không
 */
export const hasAccess = (user: User | null, requiredRole: UserRole): boolean => {
  if (!user) return false;
  if (!requiredRole) return true; // Không yêu cầu role cụ thể

  const role = getUserRole(user);

  // Admin có quyền truy cập tất cả
  if (role === "admin") return true;

  return role === requiredRole;
};

