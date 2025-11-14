import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { userService } from "@/services/user-service";

interface CreateUserFormProps {
  onUserCreated?: () => void;
}

export const CreateUserForm = ({ onUserCreated }: CreateUserFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "accountant" | "cs">("accountant");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUser = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Vui lòng nhập email hợp lệ");
      return;
    }

    if (!password || password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setIsCreating(true);

    try {
      await userService.create({
        email: email.trim().toLowerCase(),
        password: password,
        role: role,
      });

      toast.success(`Đã tạo tài khoản thành công cho ${email} với role ${role}`);

      // Reset form
      setEmail("");
      setPassword("");
      setRole("accountant");

      if (onUserCreated) {
        onUserCreated();
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Không thể tạo user. Vui lòng thử lại.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-2xl">Tạo tài khoản mới</CardTitle>
        </div>
        <CardDescription className="text-base">
          Tạo tài khoản mới cho người dùng hệ thống
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="email" className="text-base font-medium">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                id="email"
                type="email"
                placeholder="user@y99.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isCreating}
                className="h-12 text-base pl-10 focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="password" className="text-base font-medium">
              Mật khẩu
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                id="password"
                type="password"
                placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isCreating}
                className="h-12 text-base pl-10 focus:ring-2 focus:ring-primary/20"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="role" className="text-base font-medium">
              Phân quyền
            </Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "admin" | "accountant" | "cs")}
              disabled={isCreating}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin (Quản trị)</SelectItem>
                <SelectItem value="accountant">Accountant (Kế toán)</SelectItem>
                <SelectItem value="cs">CS (Chăm sóc khách hàng)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            onClick={handleCreateUser}
            disabled={isCreating || !email || !password}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5" />
                Đang tạo tài khoản...
              </>
            ) : (
              <>
                <Users className="mr-2 h-5 w-5" />
                Tạo tài khoản
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

