import { useState, useEffect } from "react";
import { OtpForm } from "@/components/OtpForm";
import { OtpHistory } from "@/components/OtpHistory";
import { Navigation } from "@/components/Navigation";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface OtpRecord {
  id: number;
  email: string;
  otp: string;
  timestamp: Date;
  status: "success" | "failed";
  expiresAt?: Date;
  lockedAt?: Date;
  failedAttemptsCount?: number;
  errorCode?: string;
  errorReason?: string;
  hasNonPendingVerification?: boolean; // true nếu có verification với status khác "pending"
  customerName?: string; // Tên khách hàng
}

const Index = () => {
  const [otpHistory, setOtpHistory] = useState<OtpRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();

    // Subscribe to realtime changes for OTP records
    const channel1 = supabase
      .channel("otp_records_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "otp_records",
        },
        (payload) => {
          console.log("Realtime update:", payload);
          loadHistory();
        }
      )
      .subscribe();

    // Subscribe to realtime changes for verifications
    const channel2 = supabase
      .channel("otp_verifications_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "otp_verifications",
        },
        (payload) => {
          console.log("Realtime update:", payload);
          loadHistory(); // Reload để filter lại OTP chưa chuyển trạng thái
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      // Tự động update expired cho các verification đang pending nhưng OTP đã hết hạn
      const { data: expiredVerifications } = await supabase
        .from("otp_verifications")
        .select(`
          *,
          otp_records (
            expires_at
          )
        `)
        .eq("approval_status", "pending");

      if (expiredVerifications) {
        const now = new Date();
        for (const verification of expiredVerifications) {
          const otpRecord = (verification as any).otp_records;
          if (otpRecord && otpRecord.expires_at) {
            const expiresAt = new Date(otpRecord.expires_at);
            if (expiresAt < now) {
              await supabase
                .from("otp_verifications")
                .update({
                  approval_status: "expired",
                  rejected_by: "system",
                  rejected_at: new Date().toISOString(),
                })
                .eq("id", verification.id);
            }
          }
        }
      }

      const { data, error } = await supabase
        .from("otp_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        // Load verifications để kiểm tra OTP đã được xử lý chưa
        const otpRecordIds = data.map((r: any) => r.id);
        const { data: verificationsData, error: verificationsError } = await supabase
          .from("otp_verifications")
          .select("otp_record_id, approval_status, verified_at")
          .in("otp_record_id", otpRecordIds)
          .order("verified_at", { ascending: false });

        if (verificationsError) {
          console.error("Error loading verifications:", verificationsError);
        }

        // Tạo map để kiểm tra OTP đã có verification với status khác pending chưa
        // Nếu có bất kỳ verification nào với status khác "pending", OTP sẽ không hiển thị
        const hasNonPendingVerification = new Map<number, boolean>();
        if (verificationsData && verificationsData.length > 0) {
          verificationsData.forEach((v: any) => {
            // Nếu có verification với status khác "pending", đánh dấu OTP này đã được xử lý
            if (v.approval_status && v.approval_status !== "pending") {
              hasNonPendingVerification.set(v.otp_record_id, true);
            }
          });
        }

        // Load failed attempts cho tất cả OTP records
        const { data: failedAttemptsData } = await supabase
          .from("otp_failed_attempts")
          .select("*")
          .in("otp_record_id", otpRecordIds)
          .order("attempted_at", { ascending: true });

        // Group failed attempts by otp_record_id
        const failedAttemptsByRecordId = new Map<number, any[]>();
        if (failedAttemptsData) {
          failedAttemptsData.forEach((attempt: any) => {
            if (!failedAttemptsByRecordId.has(attempt.otp_record_id)) {
              failedAttemptsByRecordId.set(attempt.otp_record_id, []);
            }
            failedAttemptsByRecordId.get(attempt.otp_record_id)!.push(attempt);
          });
        }

        const now = new Date();
        
        const parsed = data
          .map((record: any) => {
            const failedAttempts = failedAttemptsByRecordId.get(record.id) || [];
            const failedCount = failedAttempts.length;
            
            // Tìm thời gian bị khóa (lần nhập sai thứ 3)
            let lockedAt: Date | undefined;
            if (failedCount >= 3 && failedAttempts.length >= 3) {
              lockedAt = new Date(failedAttempts[2].attempted_at);
            }

            const hasNonPending = hasNonPendingVerification.get(record.id) === true;

            return {
              id: record.id,
              email: record.email,
              otp: record.otp,
              timestamp: new Date(record.created_at),
              status: record.status as "success" | "failed",
              expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
              lockedAt: lockedAt,
              failedAttemptsCount: failedCount,
              errorCode: record.error_code || undefined,
              errorReason: record.error_reason || undefined,
              hasNonPendingVerification: hasNonPending || false,
              customerName: record.customer_name || undefined,
            };
          })
          // Chỉ hiển thị OTP chưa chuyển trạng thái
          .filter((record) => {
            // 1. Nếu có verification với status khác "pending" (approved/rejected/expired/locked), không hiển thị
            const hasNonPending = hasNonPendingVerification.get(record.id) === true;
            if (hasNonPending) {
              return false;
            }

            // 2. Nếu OTP đã hết hạn (expires_at < now), không hiển thị
            if (record.expiresAt && record.expiresAt < now) {
              return false;
            }

            // 3. Nếu OTP đã bị khóa (failedAttemptsCount >= 3), không hiển thị
            if (record.failedAttemptsCount !== undefined && record.failedAttemptsCount >= 3) {
              return false;
            }

            // Chỉ hiển thị OTP chưa chuyển trạng thái (chưa có verification hoặc verification đang pending)
            // và chưa hết hạn, chưa bị khóa
            return true;
          });
        
        setOtpHistory(parsed);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSent = (record: OtpRecord) => {
    // Realtime will update automatically
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <Navigation />
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-6 shadow-lg">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Hệ thống gửi OTP
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Gửi mã xác thực OTP an toàn qua Gmail cho khách hàng của bạn
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* OTP Form */}
          <div>
            <OtpForm onOtpSent={handleOtpSent} />
          </div>

          {/* OTP History */}
          <div>
            <OtpHistory history={otpHistory} onDelete={() => loadHistory()} isLoading={isLoading} />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>🔒 Tất cả thông tin được mã hóa và bảo mật</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
