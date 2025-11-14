import { NavLink } from "@/components/NavLink";
import { Shield, UserCheck, Settings, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const Navigation = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success("Đã đăng xuất thành công");
    navigate("/login", { replace: true });
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case "admin":
        return "Quản trị";
      case "accountant":
        return "Kế toán";
      case "cs":
        return "CS";
      default:
        return "Người dùng";
    }
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case "admin":
        return "bg-purple-500 text-white";
      case "accountant":
        return "bg-blue-500 text-white";
      case "cs":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  if (!user) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://y99.vn/logo.png" 
              alt="Hệ thống OTP" 
              className="h-8 w-auto"
            />
          </div>
          
          <div className="flex items-center gap-4">
            {/* Chỉ hiển thị menu theo role */}
            {role === "accountant" && (
              <NavLink
                to="/accountant"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                activeClassName="bg-primary text-primary-foreground"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Kế toán</span>
                </div>
              </NavLink>
            )}
            
            {role === "cs" && (
              <NavLink
                to="/cs-verify"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                activeClassName="bg-primary text-primary-foreground"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  <span>CS</span>
                </div>
              </NavLink>
            )}

            {role === "admin" && (
              <>
                <NavLink
                  to="/accountant"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  activeClassName="bg-primary text-primary-foreground"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Kế toán</span>
                  </div>
                </NavLink>
                
                <NavLink
                  to="/cs-verify"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  activeClassName="bg-primary text-primary-foreground"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>CS</span>
                  </div>
                </NavLink>

                <NavLink
                  to="/admin"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  activeClassName="bg-primary text-primary-foreground"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span>Admin</span>
                  </div>
                </NavLink>
              </>
            )}

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-3 h-auto py-2 px-3 rounded-lg hover:bg-accent/80 transition-all duration-200"
                >
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarFallback className={getRoleBadgeColor(role)}>
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start gap-1">
                    <span className="text-sm font-semibold text-foreground leading-none">
                      {user.name || user.email.split('@')[0]}
                    </span>
                    <span className="text-xs text-muted-foreground leading-none">
                      {user.email}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-primary/30">
                      <AvatarFallback className={`${getRoleBadgeColor(role)}`}>
                        <User className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1.5 flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{user.name || user.email.split('@')[0]}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <Badge className={`w-fit text-xs px-2 py-1 ${getRoleBadgeColor(role)}`}>
                        {getRoleLabel(role)}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

