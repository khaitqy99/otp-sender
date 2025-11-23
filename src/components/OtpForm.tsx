import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Mail, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { OtpRecord } from "@/pages/Accountant";

interface OtpFormProps {
  onOtpSent: (record: OtpRecord) => void;
}

export const OtpForm = ({ onOtpSent }: OtpFormProps) => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [expiryHours, setExpiryHours] = useState<string>("0.5"); // Mặc định 0.5 giờ (30 phút) - dùng string để cho phép nhập tự do
  const [isLoading, setIsLoading] = useState(false);

  // Tự động lấy tên từ user hiện tại
  useEffect(() => {
    if (user?.name) {
      setCreatedBy(user.name);
      // Vẫn lưu vào localStorage để tương thích với code cũ (nếu cần)
      localStorage.setItem("accountantName", user.name);
    } else {
      // Fallback: lấy từ localStorage nếu user chưa có name
      const storedName = localStorage.getItem("accountantName") || "";
      setCreatedBy(storedName);
    }
  }, [user]);

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
      // Chuyển đổi từ giờ sang phút để gửi đến function
      const hoursValue = parseFloat(expiryHours) || 0.5;
      const expiryMinutes = Math.round(hoursValue * 60);

      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { 
          email, 
          otp,
          customerName: customerName.trim() || undefined, // Gửi tên khách hàng nếu có
          expiryMinutes: expiryMinutes, // Gửi thời gian hết hạn (phút)
        },
      });

      // Kiểm tra lỗi từ Supabase function
      if (error) {
        throw new Error(error.message || "Lỗi khi gọi hàm gửi email");
      }

      // Kiểm tra nếu response có chứa error từ Resend API
      if (data && data.error) {
        throw new Error(data.error);
      }

      // Kiểm tra nếu không có success flag
      if (!data || !data.success) {
        throw new Error(data?.error || "Không thể xác nhận email đã được gửi thành công");
      }

      // Lấy emailId an toàn (có thể null nếu Resend không trả về)
      const emailId = data?.emailId || null;
      console.log("Received response from send-otp:", { success: data.success, emailId, email });

      // Tính toán expires_at dựa trên số giờ (đã chuyển sang phút)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

      // Save to Supabase với resend_email_id, customer_name và expires_at
      const { data: dbData, error: dbError } = await supabase
        .from("otp_records")
        .insert({
          email,
          otp,
          status: "success",
          created_by: createdBy || null,
          resend_email_id: emailId, // Lưu email ID từ Resend để tracking (có thể null)
          customer_name: customerName.trim() || null, // Lưu tên khách hàng nếu có
          expires_at: expiresAt.toISOString(), // Set thời gian hết hạn tùy chỉnh
        })
        .select()
        .single();

      if (dbError) {
        console.error("Error saving to database:", dbError);
        // Continue anyway, don't fail the whole operation
      }

      const record: OtpRecord = {
        id: dbData?.id || 0,
        email,
        otp,
        timestamp: dbData?.created_at ? new Date(dbData.created_at) : new Date(),
        status: "success",
      };

      onOtpSent(record);
      toast.success(`Đã gửi OTP thành công đến ${email}`);
      setEmail("");
      setCustomerName(""); // Reset tên khách hàng sau khi gửi thành công
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      
      // Still save failed records to database
      try {
        await supabase.from("otp_records").insert({
          email,
          otp,
          status: "failed",
          created_by: createdBy || null,
        });
      } catch (dbError) {
        console.error("Error saving failed record:", dbError);
      }
      
      const record: OtpRecord = {
        id: 0, // Will be updated when loaded from DB
        email,
        otp,
        timestamp: new Date(),
        status: "failed",
      };
      
      onOtpSent(record);
      
      // Hiển thị thông báo lỗi chi tiết từ Resend API
      const errorMessage = error?.message || 
                          error?.error || 
                          "Không thể gửi OTP. Vui lòng kiểm tra lại địa chỉ email và thử lại.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/50 h-full flex flex-col">
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
      <CardContent className="flex-1 flex flex-col">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="createdBy" className="text-base font-medium">
              Tên kế toán
            </Label>
            <Input
              id="createdBy"
              type="text"
              placeholder={user?.name ? user.name : "Nhập tên của bạn"}
              value={createdBy}
              onChange={(e) => {
                setCreatedBy(e.target.value);
                localStorage.setItem("accountantName", e.target.value);
              }}
              disabled={isLoading}
              readOnly={!!user?.name}
              className="h-12 text-base focus:ring-2 focus:ring-primary/20 bg-muted/50"
              title={user?.name ? "Tên tự động lấy từ tài khoản của bạn" : ""}
            />
            {user?.name && (
              <p className="text-xs text-muted-foreground">
                Tên tự động lấy từ tài khoản của bạn
              </p>
            )}
          </div>
          <div className="space-y-3">
            <Label htmlFor="customerName" className="text-base font-medium">
              Tên khách hàng
            </Label>
            <Input
              id="customerName"
              type="text"
              placeholder="Nhập tên khách hàng"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isLoading}
              className="h-12 text-base focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="email" className="text-base font-medium">
              Email khách hàng
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              disabled={isLoading}
              className="h-12 text-base focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="expiryHours" className="text-base font-medium">
              Thời gian hết hạn OTP (giờ)
            </Label>
            <Input
              id="expiryHours"
              type="number"
              step="0.1"
              placeholder="0.5"
              value={expiryHours}
              onChange={(e) => {
                const inputValue = e.target.value;
                // Cho phép nhập tự do (bao gồm rỗng để có thể xóa)
                if (inputValue === "" || inputValue === ".") {
                  setExpiryHours(inputValue);
                  return;
                }
                const numValue = parseFloat(inputValue);
                if (!isNaN(numValue)) {
                  // Chỉ giới hạn nếu giá trị hợp lệ
                  const clampedValue = Math.max(0.1, Math.min(24, numValue));
                  setExpiryHours(clampedValue.toString());
                } else {
                  // Nếu không phải số, giữ nguyên giá trị cũ
                  setExpiryHours(expiryHours);
                }
              }}
              onBlur={(e) => {
                // Khi blur, đảm bảo có giá trị hợp lệ
                const numValue = parseFloat(e.target.value);
                if (isNaN(numValue) || numValue < 0.1) {
                  setExpiryHours("0.5");
                } else if (numValue > 24) {
                  setExpiryHours("24");
                } else {
                  setExpiryHours(numValue.toString());
                }
              }}
              disabled={isLoading}
              min={0.1}
              max={24}
              className="h-12 text-base focus:ring-2 focus:ring-primary/20 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
            <p className="text-xs text-muted-foreground">
              Mã OTP sẽ hết hạn sau {parseFloat(expiryHours) || 0.5} giờ ({Math.round((parseFloat(expiryHours) || 0.5) * 60)} phút) - Mặc định: 0.5 giờ (30 phút)
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5" />
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
