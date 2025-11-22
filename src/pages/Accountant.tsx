import { useState, useEffect, useCallback } from "react";
import { OtpForm } from "@/components/OtpForm";
import { OtpHistory } from "@/components/OtpHistory";
import { Navigation } from "@/components/Navigation";
import { CheckCircle2, UserCheck, Send, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface VerifiedOtp {
  id: number;
  email: string;
  otp: string;
  timestamp: Date;
  verifiedBy: string;
  verifiedAt: Date;
  approvalStatus: "pending" | "approved" | "rejected" | "expired" | "locked";
  otpStatus?: "success" | "failed";
  expiresAt?: Date;
  lockedAt?: Date;
  failedAttemptsCount?: number;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  otpRecordId?: number;
  customerName?: string; // Tên khách hàng từ otp_records
  errorCode?: string; // Error code từ Resend khi email bị bounce
  errorReason?: string; // Lý do chi tiết từ Resend khi email bị bounce
}

const Accountant = () => {
  const { user } = useAuth();
  const [otpHistory, setOtpHistory] = useState<OtpRecord[]>([]);
  const [verifiedOtps, setVerifiedOtps] = useState<VerifiedOtp[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingVerified, setIsLoadingVerified] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterCombined, setFilterCombined] = useState<string>("all");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [itemsToShow, setItemsToShow] = useState(10); // Số items hiển thị ban đầu
  const itemsPerPage = 10; // Số items thêm mỗi lần click "Xem thêm"
  const [accountantName, setAccountantName] = useState(() => {
    return localStorage.getItem("accountantName") || "";
  });

  // Tự động lấy tên từ user hiện tại
  useEffect(() => {
    if (user?.name) {
      setAccountantName(user.name);
      localStorage.setItem("accountantName", user.name);
    } else {
      // Fallback: lấy từ localStorage nếu user chưa có name
      const storedName = localStorage.getItem("accountantName") || "";
      setAccountantName(storedName);
    }
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const autoRejectExpiredOtps = useCallback(async () => {
    try {
      // Tự động set expired cho các verification có OTP đã hết hạn (quá 30 phút) và vẫn pending
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

      // Tự động set locked cho các verification có >= 3 lần nhập sai
      const { data: allPendingVerifications } = await supabase
        .from("otp_verifications")
        .select("otp_record_id")
        .eq("approval_status", "pending");

      if (allPendingVerifications) {
        for (const verification of allPendingVerifications) {
          const { data: failedAttempts } = await supabase
            .from("otp_failed_attempts")
            .select("id")
            .eq("otp_record_id", verification.otp_record_id);

          if (failedAttempts && failedAttempts.length >= 3) {
            await supabase
              .from("otp_verifications")
              .update({
                approval_status: "locked",
                rejected_by: "system",
                rejected_at: new Date().toISOString(),
              })
              .eq("otp_record_id", verification.otp_record_id)
              .eq("approval_status", "pending");
          }
        }
      }
    } catch (error) {
      console.error("Error auto-rejecting expired OTPs:", error);
    }
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
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
          console.log(`Loaded ${verificationsData.length} verifications for ${otpRecordIds.length} OTP records`);
          verificationsData.forEach((v: any) => {
            // Nếu có verification với status khác "pending", đánh dấu OTP này đã được xử lý
            if (v.approval_status && v.approval_status !== "pending") {
              hasNonPendingVerification.set(v.otp_record_id, true);
              console.log(`Found non-pending verification for OTP record ${v.otp_record_id}: ${v.approval_status}`);
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
          // Chỉ hiển thị OTP chưa có verification hoặc tất cả verifications đều pending
          .filter((record) => {
            // Nếu có verification với status khác "pending" (approved/rejected/expired/locked), không hiển thị
            if (record.hasNonPendingVerification) {
              console.log(`[FILTER] OTP ${record.id} (${record.email}) đã có verification với status khác pending, không hiển thị`);
            } else {
              console.log(`[FILTER] OTP ${record.id} (${record.email}) sẽ được hiển thị (chưa có verification hoặc vẫn pending)`);
            }
            return !record.hasNonPendingVerification;
          });
        
        setOtpHistory(parsed);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadVerifiedOtps = async () => {
    setIsLoadingVerified(true);
    try {
      // Load tất cả OTP verifications với pagination để đảm bảo không bị giới hạn
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000; // Load 1000 records mỗi lần
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("otp_verifications")
          .select(`
            *,
            otp_records (
              id,
              created_at,
              created_by,
              status,
              expires_at,
              customer_name,
              error_code,
              error_reason
            )
          `)
          .order("verified_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize; // Nếu trả về đủ pageSize, có thể còn dữ liệu
          page++;
        } else {
          hasMore = false;
        }
      }

      // Load các OTP records bị khóa (>= 3 failed attempts) nhưng chưa có verification record
      // Tìm tất cả OTP records có >= 3 failed attempts
      const { data: allFailedAttempts } = await supabase
        .from("otp_failed_attempts")
        .select("otp_record_id")
        .order("attempted_at", { ascending: true });

      // Đếm số lần nhập sai cho mỗi OTP record (cần dùng cho cả locked và expired)
      const failedCountsByRecordId = new Map<number, number>();
      if (allFailedAttempts) {
        allFailedAttempts.forEach((attempt: any) => {
          const count = failedCountsByRecordId.get(attempt.otp_record_id) || 0;
          failedCountsByRecordId.set(attempt.otp_record_id, count + 1);
        });

        // Tìm các OTP records bị khóa (>= 3 lần) nhưng chưa có verification
        const lockedOtpRecordIds: number[] = [];
        failedCountsByRecordId.forEach((count, recordId) => {
          if (count >= 3) {
            // Kiểm tra xem đã có verification record chưa
            const hasVerification = allData.some((v: any) => v.otp_record_id === recordId);
            if (!hasVerification) {
              lockedOtpRecordIds.push(recordId);
            }
          }
        });

        // Load thông tin các OTP records bị khóa
        if (lockedOtpRecordIds.length > 0) {
          // Chia nhỏ thành batch để tránh giới hạn
          const batchSize = 1000;
          let lockedOtpRecords: any[] = [];

          for (let i = 0; i < lockedOtpRecordIds.length; i += batchSize) {
            const batch = lockedOtpRecordIds.slice(i, i + batchSize);
            const { data: recordsData } = await supabase
              .from("otp_records")
              .select("*")
              .in("id", batch);

            if (recordsData) {
              lockedOtpRecords = [...lockedOtpRecords, ...recordsData];
            }
          }

          // Tạo "virtual" verification records cho các OTP bị khóa
          const { data: lockedFailedAttempts } = await supabase
            .from("otp_failed_attempts")
            .select("*")
            .in("otp_record_id", lockedOtpRecordIds)
            .order("attempted_at", { ascending: true });

          // Group failed attempts by otp_record_id
          const lockedFailedAttemptsByRecordId = new Map<number, any[]>();
          if (lockedFailedAttempts) {
            lockedFailedAttempts.forEach((attempt: any) => {
              if (!lockedFailedAttemptsByRecordId.has(attempt.otp_record_id)) {
                lockedFailedAttemptsByRecordId.set(attempt.otp_record_id, []);
              }
              lockedFailedAttemptsByRecordId.get(attempt.otp_record_id)!.push(attempt);
            });
          }

          // Tạo virtual verification records
          lockedOtpRecords.forEach((record: any) => {
            const failedAttempts = lockedFailedAttemptsByRecordId.get(record.id) || [];
            const lockedAt = failedAttempts.length >= 3 ? new Date(failedAttempts[2].attempted_at) : new Date();

            // Tạo virtual verification record
            const virtualVerification = {
              id: -record.id, // Dùng ID âm để phân biệt với verification thật
              otp_record_id: record.id,
              email: record.email,
              otp: record.otp,
              verified_by: "system",
              verified_at: lockedAt.toISOString(),
              approval_status: "locked",
              rejected_by: "system",
              rejected_at: lockedAt.toISOString(),
              created_at: record.created_at,
              otp_records: {
                id: record.id,
                created_at: record.created_at,
                created_by: record.created_by,
                status: record.status,
                expires_at: record.expires_at,
                customer_name: record.customer_name,
                error_code: record.error_code,
                error_reason: record.error_reason,
              },
            };

            allData.push(virtualVerification);
          });
        }
      }

      // Load các OTP records đã hết hạn nhưng chưa có verification record với status expired
      // Tìm tất cả OTP records đã hết hạn
      const now = new Date();
      const { data: allOtpRecords } = await supabase
        .from("otp_records")
        .select("id, email, otp, created_at, created_by, status, expires_at")
        .not("expires_at", "is", null);

      if (allOtpRecords) {
        // Tìm các OTP records đã hết hạn nhưng chưa có verification record nào (chưa được verify)
        const expiredOtpRecordIds: number[] = [];
        allOtpRecords.forEach((record: any) => {
          if (record.expires_at) {
            const expiresAt = new Date(record.expires_at);
            if (expiresAt < now) {
              // Kiểm tra xem đã có verification record nào chưa (bất kỳ status nào)
              const hasAnyVerification = allData.some(
                (v: any) => v.otp_record_id === record.id
              );
              // Chỉ thêm nếu chưa có verification record nào và chưa bị khóa (>= 3 failed attempts)
              if (!hasAnyVerification) {
                // Kiểm tra xem có bị khóa không (nếu có >= 3 failed attempts thì không thêm vào expired)
                const failedCount = failedCountsByRecordId.get(record.id) || 0;
                if (failedCount < 3) {
                  expiredOtpRecordIds.push(record.id);
                }
              }
            }
          }
        });

        // Load thông tin các OTP records đã hết hạn
        if (expiredOtpRecordIds.length > 0) {
          // Chia nhỏ thành batch để tránh giới hạn
          const batchSize = 1000;
          let expiredOtpRecords: any[] = [];

          for (let i = 0; i < expiredOtpRecordIds.length; i += batchSize) {
            const batch = expiredOtpRecordIds.slice(i, i + batchSize);
            const { data: recordsData } = await supabase
              .from("otp_records")
              .select("*")
              .in("id", batch);

            if (recordsData) {
              expiredOtpRecords = [...expiredOtpRecords, ...recordsData];
            }
          }

          // Tạo "virtual" verification records cho các OTP đã hết hạn
          expiredOtpRecords.forEach((record: any) => {
            const expiresAt = record.expires_at ? new Date(record.expires_at) : new Date();

            // Tạo virtual verification record
            const virtualVerification = {
              id: -record.id - 1000000, // Dùng ID âm lớn để phân biệt với locked và verification thật
              otp_record_id: record.id,
              email: record.email,
              otp: record.otp,
              verified_by: "system",
              verified_at: expiresAt.toISOString(),
              approval_status: "expired",
              rejected_by: "system",
              rejected_at: expiresAt.toISOString(),
              created_at: record.created_at,
              otp_records: {
                id: record.id,
                created_at: record.created_at,
                created_by: record.created_by,
                status: record.status,
                expires_at: record.expires_at,
                customer_name: record.customer_name,
                error_code: record.error_code,
                error_reason: record.error_reason,
              },
            };

            allData.push(virtualVerification);
          });
        }
      }

      if (allData.length > 0) {
        // Load failed attempts cho tất cả OTP records (chia nhỏ nếu quá nhiều)
        const otpRecordIds = allData.map((v: any) => v.otp_record_id).filter(Boolean);
        const uniqueOtpRecordIds = [...new Set(otpRecordIds)];
        
        // Supabase có giới hạn 1000 items trong .in(), nên chia nhỏ thành batch
        const batchSize = 1000;
        let allFailedAttempts: any[] = [];
        
        for (let i = 0; i < uniqueOtpRecordIds.length; i += batchSize) {
          const batch = uniqueOtpRecordIds.slice(i, i + batchSize);
          const { data: failedAttemptsBatch } = await supabase
            .from("otp_failed_attempts")
            .select("*")
            .in("otp_record_id", batch)
            .order("attempted_at", { ascending: true });
          
          if (failedAttemptsBatch) {
            allFailedAttempts = [...allFailedAttempts, ...failedAttemptsBatch];
          }
        }
        
        const failedAttemptsData = allFailedAttempts;

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

        const parsed = await Promise.all(
          allData.map(async (v: any) => {
            const otpRecordId = v.otp_record_id;
            const failedAttempts = failedAttemptsByRecordId.get(otpRecordId) || [];
            const failedCount = failedAttempts.length;
            
            // Tìm thời gian bị khóa (lần nhập sai thứ 3)
            let lockedAt: Date | undefined;
            if (failedCount >= 3 && failedAttempts.length >= 3) {
              lockedAt = new Date(failedAttempts[2].attempted_at);
            }

            // Xử lý virtual verification records (có ID âm)
            const isVirtual = v.id < 0;
            if (isVirtual && failedCount >= 3 && failedAttempts.length >= 3) {
              lockedAt = new Date(failedAttempts[2].attempted_at);
            }

            // Xác định approval status - ưu tiên locked nếu có >= 3 failed attempts
            let finalApprovalStatus = v.approval_status;
            if (!finalApprovalStatus) {
              // Nếu không có approval_status, kiểm tra failed attempts để xác định
              if (failedCount >= 3) {
                finalApprovalStatus = "locked";
              } else {
                // Mặc định là pending nếu không có thông tin
                finalApprovalStatus = "pending";
              }
            }

            return {
              id: v.id,
              email: v.email,
              otp: v.otp,
              timestamp: v.otp_records?.created_at ? new Date(v.otp_records.created_at) : new Date(v.created_at),
              verifiedBy: v.verified_by || "system",
              verifiedAt: v.verified_at ? new Date(v.verified_at) : (lockedAt || new Date()),
              approvalStatus: finalApprovalStatus as "pending" | "approved" | "rejected" | "expired" | "locked",
              otpStatus: v.otp_records?.status || undefined,
              expiresAt: v.otp_records?.expires_at ? new Date(v.otp_records.expires_at) : undefined,
              lockedAt: lockedAt,
              failedAttemptsCount: failedCount,
              otpRecordId: otpRecordId,
              approvedBy: v.approved_by,
              approvedAt: v.approved_at ? new Date(v.approved_at) : undefined,
              rejectedBy: v.rejected_by,
              rejectedAt: v.rejected_at ? new Date(v.rejected_at) : undefined,
              customerName: v.otp_records?.customer_name || undefined,
              errorCode: v.otp_records?.error_code || undefined,
              errorReason: v.otp_records?.error_reason || undefined,
            };
          })
        );
        setVerifiedOtps(parsed);
      }
    } catch (error) {
      console.error("Error loading verifications:", error);
    } finally {
      setIsLoadingVerified(false);
    }
  };

  useEffect(() => {
    // Tự động reject các OTP đã hết hạn hoặc có >= 3 lần nhập sai
    autoRejectExpiredOtps().then(() => {
      loadHistory();
      loadVerifiedOtps();
    });

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
          loadVerifiedOtps();
          loadHistory(); // Cập nhật history khi có thay đổi verification
        }
      )
      .subscribe();

    // Tự động check và reject định kỳ mỗi phút
    const interval = setInterval(() => {
      autoRejectExpiredOtps().then(() => {
        loadVerifiedOtps();
      });
    }, 60000); // 1 phút

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
      clearInterval(interval);
    };
  }, [autoRejectExpiredOtps]);

  const handleOtpSent = (record: OtpRecord) => {
    // Realtime will update automatically
  };

  const handleApprove = async (otpId: number) => {
    // Không xử lý virtual records (ID âm)
    if (otpId < 0) {
      toast.error("Không thể xác nhận OTP bị khóa");
      return;
    }

    // Tự động sử dụng tên từ user nếu có
    const finalAccountantName = accountantName.trim() || user?.name || "";
    if (!finalAccountantName) {
      toast.error("Vui lòng nhập tên kế toán hoặc cập nhật tên trong tài khoản của bạn");
      return;
    }

    try {
      const { error } = await supabase
        .from("otp_verifications")
        .update({
          approval_status: "approved",
          approved_by: finalAccountantName,
          approved_at: new Date().toISOString(),
        })
        .eq("id", otpId);

      if (error) throw error;

      // Đợi một chút để đảm bảo database đã được cập nhật
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await Promise.all([loadVerifiedOtps(), loadHistory()]);
      toast.success("Đã xác nhận OTP thành công");
    } catch (error: any) {
      console.error("Error approving OTP:", error);
      toast.error(error.message || "Không thể xác nhận OTP");
    }
  };

  const handleReject = async (otpId: number) => {
    // Không xử lý virtual records (ID âm)
    if (otpId < 0) {
      toast.error("Không thể từ chối OTP bị khóa");
      return;
    }

    // Tự động sử dụng tên từ user nếu có
    const finalAccountantName = accountantName.trim() || user?.name || "";
    if (!finalAccountantName) {
      toast.error("Vui lòng nhập tên kế toán hoặc cập nhật tên trong tài khoản của bạn");
      return;
    }

    try {
      const { error } = await supabase
        .from("otp_verifications")
        .update({
          approval_status: "rejected",
          rejected_by: finalAccountantName,
          rejected_at: new Date().toISOString(),
        })
        .eq("id", otpId);

      if (error) throw error;

      // Đợi một chút để đảm bảo database đã được cập nhật
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await Promise.all([loadVerifiedOtps(), loadHistory()]);
      toast.success("Đã từ chối OTP");
    } catch (error: any) {
      console.error("Error rejecting OTP:", error);
      toast.error(error.message || "Không thể từ chối OTP");
    }
  };

  const filteredOtps = verifiedOtps.filter((otp) => {
    const matchesEmail = otp.email.toLowerCase().includes(searchEmail.toLowerCase());
    
    if (filterCombined === "all") {
      return matchesEmail;
    }
    
    // Chỉ filter theo approval status (không có kết hợp)
    return matchesEmail && otp.approvalStatus === filterCombined;
  });

  // Tính toán các trạng thái có sẵn trong dữ liệu (chỉ approval status đơn, không có kết hợp)
  const getAvailableFilters = () => {
    const filters = new Set<string>();
    filters.add("all");

    // Đếm số lượng OTP theo từng approval status
    const statusCounts = new Map<string, number>();

    verifiedOtps.forEach((otp) => {
      // Chỉ đếm approval status đơn
      const count = statusCounts.get(otp.approvalStatus) || 0;
      statusCounts.set(otp.approvalStatus, count + 1);
    });

    // Chỉ thêm các trạng thái có ít nhất 1 OTP
    statusCounts.forEach((count, status) => {
      if (count > 0) {
        filters.add(status);
      }
    });

    return Array.from(filters);
  };

  const availableFilters = getAvailableFilters();

  // Reset filter về "all" nếu filter hiện tại không còn trong danh sách có sẵn
  useEffect(() => {
    if (filterCombined !== "all" && !availableFilters.includes(filterCombined)) {
      setFilterCombined("all");
    }
  }, [availableFilters, filterCombined]);

  // Reset itemsToShow khi filter hoặc search thay đổi
  useEffect(() => {
    setItemsToShow(10);
  }, [filterCombined, searchEmail]);

  // Sắp xếp từ mới nhất đến cũ nhất
  const sortedOtps = [...filteredOtps].sort((a, b) => {
    // Sắp xếp từ mới nhất đến cũ nhất (theo verifiedAt)
    return b.verifiedAt.getTime() - a.verifiedAt.getTime();
  });

  // Lấy số items để hiển thị
  const displayedOtps = sortedOtps.slice(0, itemsToShow);
  const hasMore = sortedOtps.length > itemsToShow;

  const getFilterLabel = (filterValue: string) => {
    if (filterValue === "all") return "Tất cả";
    
    const approvalLabels: Record<string, string> = {
      pending: "Chờ xử lý",
      approved: "Đã xác nhận",
      rejected: "Đã từ chối",
      expired: "Đã hết hạn",
      locked: "Đã bị khóa",
    };
    
    return approvalLabels[filterValue] || filterValue;
  };

  const pendingCount = verifiedOtps.filter((o) => o.approvalStatus === "pending").length;
  const approvedCount = verifiedOtps.filter((o) => o.approvalStatus === "approved").length;
  const rejectedCount = verifiedOtps.filter((o) => o.approvalStatus === "rejected").length;
  const expiredCount = verifiedOtps.filter((o) => o.approvalStatus === "expired").length;
  const lockedCount = verifiedOtps.filter((o) => o.approvalStatus === "locked").length;

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const getTimeRemaining = (expiresAt: Date) => {
    const now = currentTime;
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) {
      return "Đã hết hạn";
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `Còn ${minutes} phút ${seconds} giây`;
    } else {
      return `Còn ${seconds} giây`;
    }
  };

  const copyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    toast.success("Đã sao chép OTP");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <Navigation />
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="space-y-8">
          {/* Phần Gửi OTP */}
          <div className="grid lg:grid-cols-2 gap-8 items-stretch">
            {/* OTP Form */}
            <div className="h-full">
              <OtpForm onOtpSent={handleOtpSent} />
            </div>

            {/* OTP History */}
            <div className="h-full">
              <OtpHistory history={otpHistory} onDelete={() => loadHistory()} isLoading={isLoadingHistory} />
            </div>
          </div>

          {/* Phần Kiểm tra OTP */}
          <div>
            <Card className="shadow-lg border-border/50">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                    </div>
                    <CardTitle className="text-2xl">Danh sách OTP đã xác thực</CardTitle>
                    {/* Search */}
                    <div className="relative flex-1 max-w-md ml-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                      <Input
                        type="text"
                        placeholder="Tìm kiếm theo email..."
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        className="pl-10 h-10"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accountantName" className="text-sm font-medium whitespace-nowrap">
                      Tên kế toán:
                    </Label>
                    <Input
                      id="accountantName"
                      type="text"
                      placeholder={user?.name ? user.name : "Nhập tên của bạn"}
                      value={accountantName}
                      onChange={(e) => {
                        setAccountantName(e.target.value);
                        localStorage.setItem("accountantName", e.target.value);
                      }}
                      readOnly={!!user?.name}
                      className="h-10 w-48 bg-muted/50"
                      title={user?.name ? "Tên tự động lấy từ tài khoản của bạn" : ""}
                    />
                    {user?.name && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        (Tự động)
                      </span>
                    )}
                  </div>
                </div>
                <CardDescription className="text-base">
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "all" ? "text-primary font-semibold" : ""}`}
                    onClick={() => setFilterCombined("all")}
                  >
                    Tổng số: {sortedOtps.length} OTP
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "pending" ? "text-primary font-semibold" : ""}`}
                    onClick={() => setFilterCombined("pending")}
                  >
                    Chờ xử lý: {pendingCount}
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "approved" ? "text-primary font-semibold" : ""}`}
                    onClick={() => setFilterCombined("approved")}
                  >
                    Đã xác nhận: {approvedCount}
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "rejected" ? "text-primary font-semibold" : ""}`}
                    onClick={() => setFilterCombined("rejected")}
                  >
                    Đã từ chối: {rejectedCount}
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "expired" ? "text-primary font-semibold" : ""}`}
                    onClick={() => setFilterCombined("expired")}
                  >
                    Hết hạn: {expiredCount}
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "locked" ? "text-primary font-semibold" : ""}`}
                    onClick={() => setFilterCombined("locked")}
                  >
                    Bị khóa: {lockedCount}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>

                {/* OTP List */}
                <div className="space-y-3">
                  {isLoadingVerified ? (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <Skeleton className="h-4 w-48 mb-2" />
                                <Skeleton className="h-3 w-32" />
                              </div>
                              <Skeleton className="h-5 w-20" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-6 w-16" />
                              <Skeleton className="h-7 w-7 rounded" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : sortedOtps.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-base">
                        {searchEmail ? "Không tìm thấy OTP nào" : "Chưa có OTP nào được xác thực"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {displayedOtps.map((otp) => (
                        <div
                          key={otp.id}
                          className={`p-3 rounded-lg border ${
                            otp.approvalStatus === "pending"
                              ? "bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
                              : otp.approvalStatus === "approved"
                                ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                : otp.approvalStatus === "expired"
                                  ? "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                                  : otp.approvalStatus === "locked"
                                    ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800"
                                    : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                          }`}
                        >
                          {/* Header: Email và Status */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {otp.email}
                                </p>
                                {otp.customerName && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    Khách hàng: {otp.customerName}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant={
                                  otp.approvalStatus === "pending"
                                    ? "default"
                                    : otp.approvalStatus === "approved"
                                      ? "default"
                                      : "destructive"
                                }
                                className={
                                  otp.approvalStatus === "pending"
                                    ? "bg-yellow-500 text-white text-xs"
                                    : otp.approvalStatus === "approved"
                                      ? "bg-green-500 text-white text-xs"
                                      : otp.approvalStatus === "expired"
                                        ? "bg-orange-500 text-white text-xs"
                                        : otp.approvalStatus === "locked"
                                          ? "bg-purple-500 text-white text-xs"
                                          : "text-xs"
                                }
                              >
                                {otp.approvalStatus === "pending"
                                  ? "Chờ xử lý"
                                  : otp.approvalStatus === "approved"
                                    ? "Đã xác nhận"
                                    : otp.approvalStatus === "expired"
                                      ? "Đã hết hạn"
                                      : otp.approvalStatus === "locked"
                                        ? "Đã bị khóa"
                                        : "Đã từ chối"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="font-mono text-sm px-2 py-1 bg-muted/30"
                              >
                                {otp.otp}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyOtp(otp.otp)}
                                className="h-7 w-7 p-0"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Thông tin chi tiết - Compact nhưng đầy đủ */}
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                            {/* Hàng 1: CS xác thực và Thời gian còn lại */}
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-muted-foreground truncate">
                                <span className="font-medium">CS:</span> {otp.id < 0 ? "Chưa xác thực" : otp.verifiedBy}
                              </p>
                            </div>
                            {otp.expiresAt && otp.approvalStatus === "pending" && (
                              <div className="flex items-center gap-1.5">
                                <Clock className={`w-3 h-3 flex-shrink-0 ${
                                  otp.expiresAt < currentTime
                                    ? "text-red-500"
                                    : "text-orange-500"
                                }`} />
                                <p className={`truncate ${
                                  otp.expiresAt < currentTime
                                    ? "text-red-600 dark:text-red-400 font-medium"
                                    : "text-orange-600 dark:text-orange-400 font-medium"
                                }`}>
                                  {getTimeRemaining(otp.expiresAt)}
                                </p>
                              </div>
                            )}
                            
                            {/* Hàng 2: Thời gian xác thực và Thời gian gửi */}
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-muted-foreground truncate" title={formatDateTime(otp.verifiedAt)}>
                                <span className="font-medium">Xác thực:</span> {formatDateTime(otp.verifiedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Send className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-muted-foreground truncate" title={formatDateTime(otp.timestamp)}>
                                <span className="font-medium">Gửi:</span> {formatDateTime(otp.timestamp)}
                              </p>
                            </div>

                            {/* Hàng 3: Tình trạng OTP và Thông tin khóa/nhập sai */}
                            {otp.otpStatus && (
                              <div className="flex items-center gap-1.5">
                                {otp.otpStatus === "success" ? (
                                  <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                )}
                                <p className={`truncate ${
                                  otp.otpStatus === "success"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}>
                                  <span className="font-medium">OTP:</span> {otp.otpStatus === "success" ? "Thành công" : "Thất bại"}
                                  {otp.otpStatus === "failed" && otp.errorCode && (
                                    <span className="ml-1 text-xs opacity-75">
                                      ({otp.errorCode === "550" || otp.errorCode === "FAILED" || otp.errorCode === "BOUNCED" 
                                        ? "Bị từ chối" 
                                        : otp.errorCode === "COMPLAINED" 
                                        ? "Bị báo spam" 
                                        : otp.errorCode})
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                            {/* Hiển thị error reason khi OTP failed */}
                            {otp.otpStatus === "failed" && otp.errorReason && (
                              <div className="flex items-start gap-1.5 col-span-2">
                                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-red-600 dark:text-red-400 text-xs">
                                  <span className="font-medium">Lý do:</span> {otp.errorReason}
                                </p>
                              </div>
                            )}
                            {otp.lockedAt ? (
                              <div className="flex items-center gap-1.5">
                                <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                <p className="text-red-600 dark:text-red-400 truncate">
                                  <span className="font-medium">Khóa:</span> {formatDateTime(otp.lockedAt)}
                                  {otp.failedAttemptsCount !== undefined && ` (${otp.failedAttemptsCount} lần)`}
                                </p>
                              </div>
                            ) : otp.failedAttemptsCount !== undefined && otp.failedAttemptsCount > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                                <p className="text-orange-600 dark:text-orange-400 truncate">
                                  <span className="font-medium">Sai:</span> {otp.failedAttemptsCount}/3
                                </p>
                              </div>
                            ) : null}

                            {/* Hàng 4: Thông tin xác nhận/từ chối (nếu có) */}
                            {otp.approvalStatus === "approved" && otp.approvedBy && (
                              <div className="flex items-center gap-1.5 col-span-2">
                                <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                <p className="text-green-600 dark:text-green-400 truncate">
                                  <span className="font-medium">Xác nhận bởi:</span> {otp.approvedBy} lúc {otp.approvedAt && formatDateTime(otp.approvedAt)}
                                </p>
                              </div>
                            )}
                            {otp.approvalStatus === "rejected" && otp.rejectedBy && (
                              <div className="flex items-center gap-1.5 col-span-2">
                                <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                <p className="text-red-600 dark:text-red-400 truncate">
                                  <span className="font-medium">Từ chối bởi:</span> {otp.rejectedBy} lúc {otp.rejectedAt && formatDateTime(otp.rejectedAt)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons - Chỉ hiển thị cho verification thật (ID dương) */}
                          {otp.approvalStatus === "pending" && otp.id > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprove(otp.id)}
                                className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Xác nhận
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleReject(otp.id)}
                                className="flex-1 h-8 text-xs"
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                                Từ chối
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Show More Button */}
                      {hasMore && (
                        <div className="mt-6 text-center">
                          <Button
                            variant="outline"
                            onClick={() => setItemsToShow((prev) => prev + itemsPerPage)}
                            className="w-full sm:w-auto"
                          >
                            Xem thêm ({sortedOtps.length - itemsToShow} OTP còn lại)
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
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

export default Accountant;

