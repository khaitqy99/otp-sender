import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthService } from "@/services/auth-service";
import type { User } from "@/services/user-service";

type UserRole = "admin" | "accountant" | "cs" | null;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(null);

  useEffect(() => {
    // Get initial user from session storage (giống y99kpinew)
    const loadUser = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        setUser(currentUser);
        
        if (currentUser) {
          setRole(currentUser.role as UserRole);
          console.log("AuthContext - Initial load - User:", currentUser.email, "Role:", currentUser.role);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setUser(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Listen for storage changes (khi user login/logout ở tab khác)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user' || e.key === null) {
        loadUser();
      }
    };

    // Listen for custom event (khi login trong cùng tab)
    const handleCustomStorage = () => {
      loadUser();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userLogin', handleCustomStorage);
    window.addEventListener('userLogout', handleCustomStorage);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userLogin', handleCustomStorage);
      window.removeEventListener('userLogout', handleCustomStorage);
    };
  }, []);

  const signOut = async () => {
    await AuthService.logout();
    setUser(null);
    setRole(null);
    // Trigger event để các component khác cập nhật
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('userLogout'));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

