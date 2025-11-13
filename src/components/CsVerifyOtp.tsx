import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OtpVerification {
  id: number;
  email: string;
  otp: string;
  timestamp: Date;
  verifiedBy: string;
  verifiedAt: Date;
  approvalStatus: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
}

export const CsVerifyOtp = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [csName, setCsName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationHistory, setVerificationHistory] = useState<OtpVerification[]>([]);

  // Load verification history from Supabase
  useEffect(() => {
    loadHistory();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("cs_verifications_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "otp_verifications",
        },
        (payload) => {
          console.log("Realtime update:", payload);
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("otp_verifications")
        .select("*")
        .order("verified_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data) {
        const parsed = data.map((v: any) => ({
          id: v.id,
          email: v.email,
          otp: v.otp,
          timestamp: new Date(v.created_at),
          verifiedBy: v.verified_by,
          verifiedAt: new Date(v.verified_at),
          approvalStatus: v.approval_status,
        }));
        setVerificationHistory(parsed);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Vui lòng nhập email hợp lệ");
      return;
    }

    if (!otp || otp.length !== 6) {
      toast.error("Vui lòng nhập mã OTP 6 chữ số");
      return;
    }

    if (!csName.trim()) {
      toast.error("Vui lòng nhập tên CS");
      return;
    }

    setIsLoading(true);

    try {
      // Tìm OTP record theo email (lấy OTP mới nhất)
      const { data: otpRecords, error: findError } = await supabase
        .from("otp_records")
        .select("*")
        .eq("email", email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(1);

      if (findError || !otpRecords || otpRecords.length === 0) {
        toast.error("Không tìm thấy OTP cho email này");
        setIsLoading(false);
        return;
      }

      const otpRecord = otpRecords[0];

      // Kiểm tra OTP có hết hạn không (quá 30 phút)
      const expiresAt = otpRecord.expires_at ? new Date(otpRecord.expires_at) : null;
      const now = new Date();
      if (expiresAt && expiresAt < now) {
        toast.error("OTP đã hết hạn (quá 30 phút)");
        setIsLoading(false);
        return;
      }

      // Đếm số lần nhập sai cho OTP record này
      const { data: failedAttempts, error: failedError } = await supabase
        .from("otp_failed_attempts")
        .select("id")
        .eq("otp_record_id", otpRecord.id);

      const failedCount = failedAttempts?.length || 0;

      // Kiểm tra nếu đã có >= 3 lần nhập sai
      if (failedCount >= 3) {
        toast.error("OTP đã bị khóa do nhập sai quá 3 lần");
        setIsLoading(false);
        return;
      }

      // Kiểm tra OTP có đúng không
      if (otpRecord.otp !== otp) {
        // Lưu lần nhập sai vào database
        await supabase
          .from("otp_failed_attempts")
          .insert({
            otp_record_id: otpRecord.id,
            email: email.toLowerCase(),
            attempted_otp: otp,
          });

        const newFailedCount = failedCount + 1;
        const remainingAttempts = 3 - newFailedCount;

        if (newFailedCount >= 3) {
          toast.error("Mã OTP sai. Đã nhập sai 3 lần, OTP đã bị khóa");
        } else {
          toast.error(`Mã OTP sai. Còn ${remainingAttempts} lần thử`);
        }

        setIsLoading(false);
        return;
      }

      // OTP đúng - kiểm tra xem đã được verify chưa
      const { data: existingVerifications } = await supabase
        .from("otp_verifications")
        .select("*")
        .eq("otp_record_id", otpRecord.id)
        .limit(1);

      if (existingVerifications && existingVerifications.length > 0) {
        toast.warning("OTP này đã được xác thực trước đó");
        setIsLoading(false);
        return;
      }

      // Tạo verification record
      const { data: verificationData, error: insertError } = await supabase
        .from("otp_verifications")
        .insert({
          otp_record_id: otpRecord.id,
          email: otpRecord.email,
          otp: otp,
          verified_by: csName,
          verified_at: new Date().toISOString(),
          approval_status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Reload history
      await loadHistory();

      toast.success(`Đã xác thực OTP thành công cho ${email}`);
      setEmail("");
      setOtp("");
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      toast.error(error.message || "Không thể xác thực OTP");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border/50">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-2xl">Xác thực OTP từ khách hàng</CardTitle>
          </div>
          <CardDescription className="text-base">
            Nhập email và mã OTP mà khách hàng đọc cho bạn để xác thực
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="csName" className="text-base font-medium">
                Tên CS
              </Label>
              <Input
                id="csName"
                type="text"
                placeholder="Nhập tên của bạn"
                value={csName}
                onChange={(e) => setCsName(e.target.value)}
                disabled={isLoading}
                className="h-12 text-base focus:ring-2 focus:ring-primary/20"
                required
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
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-12 text-base focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="otp" className="text-base font-medium">
                Mã OTP từ khách hàng
              </Label>
              <Input
                id="otp"
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isLoading}
                className="h-12 text-base font-mono text-center text-2xl tracking-widest focus:ring-2 focus:ring-primary/20"
                maxLength={6}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Xác thực OTP
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Verification History */}
      {verificationHistory.length > 0 && (
        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl">Lịch sử xác thực gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {verificationHistory.slice(-10).reverse().map((verification) => (
                <div
                  key={verification.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {verification.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Xác thực bởi: {verification.verifiedBy}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        }).format(verification.verifiedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-primary">
                        {verification.otp}
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-success mt-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

