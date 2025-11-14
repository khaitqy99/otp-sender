import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { CreateUserForm } from "@/components/CreateUserForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Shield, 
  Mail, 
  Lock, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Copy,
  Trash2,
  Search,
  UserCog,
  Send,
  Clock,
  UserCheck,
  AlertCircle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { userService } from "@/services/user-service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import type { User } from "@/services/user-service";

interface OtpRecord {
  id: number;
  email: string;
  otp: string;
  status: "success" | "failed";
  created_at: string;
  created_by?: string;
  customer_name?: string;
  error_code?: string;
  error_reason?: string;
  expires_at?: string;
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
  customerName?: string;
}

const Admin = () => {
  const [activeTab, setActiveTab] = useState("users");
  
  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<number | null>(null);

  // OTP management state
  const [otpRecords, setOtpRecords] = useState<OtpRecord[]>([]);
  const [isLoadingOtps, setIsLoadingOtps] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Verified OTPs state (from otp_verifications table)
  const [verifiedOtps, setVerifiedOtps] = useState<VerifiedOtp[]>([]);
  const [isLoadingVerified, setIsLoadingVerified] = useState(false);
  const [searchEmailVerified, setSearchEmailVerified] = useState("");
  const [filterCombined, setFilterCombined] = useState<string>("all");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [itemsToShow, setItemsToShow] = useState(10);
  const itemsPerPage = 10;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      loadUsers();
    } else if (activeTab === "verified") {
      loadVerifiedOtps();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await userService.getAll();
      setUsers(users);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast.error(error.message || "Không thể tải danh sách users");
    } finally {
      setIsLoadingUsers(false);
    }
  };


  const loadAllOtps = async () => {
    setIsLoadingOtps(true);
    try {
      const { data, error } = await supabase
        .from("otp_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500); // Load 500 records gần nhất

      if (error) throw error;

      if (data) {
        setOtpRecords(data);
      }
    } catch (error: any) {
      console.error("Error loading OTPs:", error);
      toast.error("Không thể tải danh sách OTP");
    } finally {
      setIsLoadingOtps(false);
    }
  };

  const handleDeleteOtp = async (otpId: number) => {
    setDeletingId(otpId);
    try {
      const { error } = await supabase
        .from("otp_records")
        .delete()
        .eq("id", otpId);

      if (error) {
        throw error;
      }

      toast.success("Đã xóa OTP khỏi database");
      await loadAllOtps();
    } catch (error: any) {
      console.error("Error deleting OTP:", error);
      toast.error("Không thể xóa OTP. Vui lòng thử lại.");
    } finally {
      setDeletingId(null);
    }
  };

  const copyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    toast.success("Đã sao chép OTP");
  };

  const formatDateTime = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dateObj);
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
              customer_name
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
        .select("id, email, otp, created_at, created_by, status, expires_at, customer_name")
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
            };
          })
        );
        setVerifiedOtps(parsed);
      } else {
        setVerifiedOtps([]);
      }
    } catch (error: any) {
      console.error("Error loading verified OTPs:", error);
      toast.error("Không thể tải danh sách OTP đã xác thực");
    } finally {
      setIsLoadingVerified(false);
    }
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

  const handleUpdateRole = async (userId: number, newRole: "admin" | "accountant" | "cs") => {
    setUpdatingRoleUserId(userId);
    try {
      await userService.updateRole(userId, newRole);
      toast.success("Đã cập nhật role thành công");
      await loadUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message || "Không thể cập nhật role. Vui lòng thử lại.");
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const getRoleBadgeColor = (role?: string) => {
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

  // Filter OTPs by search email
  const filteredOtps = searchEmail
    ? otpRecords.filter((otp) =>
        otp.email.toLowerCase().includes(searchEmail.toLowerCase())
      )
    : otpRecords;

  // Filter verified OTPs
  let filteredVerifiedOtps = verifiedOtps;
  
  // Filter by email
  if (searchEmailVerified) {
    filteredVerifiedOtps = filteredVerifiedOtps.filter((otp) =>
      otp.email.toLowerCase().includes(searchEmailVerified.toLowerCase())
    );
  }

  // Filter by status
  if (filterCombined !== "all") {
    filteredVerifiedOtps = filteredVerifiedOtps.filter(
      (otp) => otp.approvalStatus === filterCombined
    );
  }

  // Sort verified OTPs
  const sortedVerifiedOtps = [...filteredVerifiedOtps].sort((a, b) => {
    return b.verifiedAt.getTime() - a.verifiedAt.getTime();
  });

  // Pagination
  const displayedVerifiedOtps = sortedVerifiedOtps.slice(0, itemsToShow);
  const hasMoreVerified = sortedVerifiedOtps.length > itemsToShow;

  // Counts for verified OTPs
  const pendingCount = verifiedOtps.filter((o) => o.approvalStatus === "pending").length;
  const approvedCount = verifiedOtps.filter((o) => o.approvalStatus === "approved").length;
  const rejectedCount = verifiedOtps.filter((o) => o.approvalStatus === "rejected").length;
  const expiredCount = verifiedOtps.filter((o) => o.approvalStatus === "expired").length;
  const lockedCount = verifiedOtps.filter((o) => o.approvalStatus === "locked").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <Navigation />
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-4xl font-bold">Quản trị hệ thống</h1>
            </div>
            <TabsList className="grid w-full max-w-md grid-cols-2 h-10">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Quản lý Users
              </TabsTrigger>
              <TabsTrigger value="verified" className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                OTP đã xác thực ({verifiedOtps.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab: User Management */}
          <TabsContent value="users" className="space-y-6">
            <CreateUserForm onUserCreated={loadUsers} />

            {/* Users List */}
            <Card className="shadow-lg border-border/50">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <Users className="w-5 h-5 text-accent" />
                    </div>
                    <CardTitle className="text-2xl">Danh sách Users</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    onClick={loadUsers}
                    disabled={isLoadingUsers}
                    size="sm"
                  >
                    {isLoadingUsers ? (
                      <Loader2 className="w-4 h-4" />
                    ) : (
                      "Làm mới"
                    )}
                  </Button>
                </div>
                <CardDescription className="text-base">
                  Tổng số: {users.length} users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <Skeleton className="h-4 w-48 mb-2" />
                              <div className="flex items-center gap-4">
                                <Skeleton className="h-3 w-32" />
                                <Skeleton className="h-3 w-32" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-6 w-20" />
                              <Skeleton className="h-9 w-40" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-base">Chưa có user nào</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {users.map((userItem) => (
                        <div
                          key={userItem.id}
                          className="p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {userItem.email}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Tạo: {formatDateTime(userItem.created_at)}</span>
                                {userItem.last_login && (
                                  <span>Đăng nhập cuối: {formatDateTime(userItem.last_login)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={getRoleBadgeColor(userItem.role)}>
                                {userItem.role || "Chưa có role"}
                              </Badge>
                              <Select
                                value={userItem.role || ""}
                                onValueChange={(value) => handleUpdateRole(userItem.id, value as "admin" | "accountant" | "cs")}
                                disabled={updatingRoleUserId === userItem.id}
                              >
                                <SelectTrigger className="w-40 h-9">
                                  <SelectValue placeholder="Chọn role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="accountant">Accountant</SelectItem>
                                  <SelectItem value="cs">CS</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Verified OTPs */}
          <TabsContent value="verified" className="space-y-6">
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
                        value={searchEmailVerified}
                        onChange={(e) => {
                          setSearchEmailVerified(e.target.value);
                          setItemsToShow(10); // Reset pagination
                        }}
                        className="pl-10 h-10"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={loadVerifiedOtps}
                    disabled={isLoadingVerified}
                    size="sm"
                  >
                    {isLoadingVerified ? (
                      <Loader2 className="w-4 h-4" />
                    ) : (
                      "Làm mới"
                    )}
                  </Button>
                </div>
                <CardDescription className="text-base">
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "all" ? "text-primary font-semibold" : ""}`}
                    onClick={() => {
                      setFilterCombined("all");
                      setItemsToShow(10);
                    }}
                  >
                    Tổng số: {sortedVerifiedOtps.length} OTP
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "pending" ? "text-primary font-semibold" : ""}`}
                    onClick={() => {
                      setFilterCombined("pending");
                      setItemsToShow(10);
                    }}
                  >
                    Chờ xử lý: {pendingCount}
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "approved" ? "text-primary font-semibold" : ""}`}
                    onClick={() => {
                      setFilterCombined("approved");
                      setItemsToShow(10);
                    }}
                  >
                    Đã xác nhận: {approvedCount}
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "rejected" ? "text-primary font-semibold" : ""}`}
                    onClick={() => {
                      setFilterCombined("rejected");
                      setItemsToShow(10);
                    }}
                  >
                    Đã từ chối: {rejectedCount}
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "expired" ? "text-primary font-semibold" : ""}`}
                    onClick={() => {
                      setFilterCombined("expired");
                      setItemsToShow(10);
                    }}
                  >
                    Hết hạn: {expiredCount}
                  </span>
                  {" | "}
                  <span 
                    className={`cursor-pointer hover:text-foreground ${filterCombined === "locked" ? "text-primary font-semibold" : ""}`}
                    onClick={() => {
                      setFilterCombined("locked");
                      setItemsToShow(10);
                    }}
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
                  ) : sortedVerifiedOtps.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-base">
                        {searchEmailVerified ? "Không tìm thấy OTP nào" : "Chưa có OTP nào được xác thực"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {displayedVerifiedOtps.map((otp) => (
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
                        </div>
                      ))}

                      {/* Show More Button */}
                      {hasMoreVerified && (
                        <div className="mt-6 text-center">
                          <Button
                            variant="outline"
                            onClick={() => setItemsToShow((prev) => prev + itemsPerPage)}
                            className="w-full sm:w-auto"
                          >
                            Xem thêm ({sortedVerifiedOtps.length - itemsToShow} OTP còn lại)
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;

