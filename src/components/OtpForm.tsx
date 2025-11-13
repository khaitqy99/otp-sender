import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Mail, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { OtpRecord } from "@/pages/Index";

interface OtpFormProps {
  onOtpSent: (record: OtpRecord) => void;
}

export const OtpForm = ({ onOtpSent }: OtpFormProps) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Vui lòng nhập email hợp lệ");
      return;
    }

    setIsLoading(true);
    const otp = generateOtp();

    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email, otp },
      });

      if (error) throw error;

      const record: OtpRecord = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        otp,
        timestamp: new Date(),
        status: "success",
      };

      onOtpSent(record);
      toast.success(`Đã gửi OTP thành công đến ${email}`);
      setEmail("");
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      
      const record: OtpRecord = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        otp,
        timestamp: new Date(),
        status: "failed",
      };
      
      onOtpSent(record);
      toast.error(error.message || "Không thể gửi OTP. Vui lòng kiểm tra cấu hình Gmail.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/50 hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-2xl">Gửi OTP mới</CardTitle>
        </div>
        <CardDescription className="text-base">
          Nhập email khách hàng để gửi mã xác thực OTP
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="email" className="text-base font-medium">
              Email khách hàng
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-12 text-base transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Gửi OTP
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
