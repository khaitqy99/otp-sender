import { NavLink } from "@/components/NavLink";
import { Shield, UserCheck } from "lucide-react";

export const Navigation = () => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">Hệ thống OTP</span>
          </div>
          
          <div className="flex items-center gap-1">
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
              to="/cs"
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              activeClassName="bg-primary text-primary-foreground"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span>CS</span>
              </div>
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
};

