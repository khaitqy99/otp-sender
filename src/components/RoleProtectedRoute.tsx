import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { hasAccess } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";

interface RoleProtectedRouteProps {
  children: ReactNode;
  requiredRole: UserRole;
  redirectTo?: string;
}

export const RoleProtectedRoute = ({ 
  children, 
  requiredRole,
  redirectTo 
}: RoleProtectedRouteProps) => {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login with return url
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Check role access
  // Admin có quyền truy cập tất cả
  if (user.role === "admin") {
    return <>{children}</>;
  }

  if (!hasAccess(user, requiredRole)) {
    // Redirect to appropriate page based on user role
    let defaultRedirect = "/accountant";
    if (user.role === "cs") {
      defaultRedirect = "/cs-verify";
    }
    
    const redirect = redirectTo || defaultRedirect;
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
};

