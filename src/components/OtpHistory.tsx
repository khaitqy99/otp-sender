import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { OtpRecord } from "@/pages/Accountant";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
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

interface OtpHistoryProps {
  history: OtpRecord[];
  onDelete?: (id: number) => void; // Callback để reload history sau khi xóa
  isLoading?: boolean;
}

export const OtpHistory = ({ history, onDelete, isLoading = false }: OtpHistoryProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [itemsToShow, setItemsToShow] = useState(3); // Số OTP hiển thị ban đầu
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

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

  const handleDelete = async (otpId: number) => {
    setDeletingId(otpId);
    try {
      // Xóa OTP record từ database
      // Vì có ON DELETE CASCADE, các verifications và failed attempts liên quan cũng sẽ bị xóa tự động
      const { error } = await supabase
        .from("otp_records")
        .delete()
        .eq("id", otpId);

      if (error) {
        console.error("Error deleting OTP:", error);
        toast.error("Không thể xóa OTP. Vui lòng thử lại.");
        return;
      }

      toast.success("Đã xóa OTP khỏi lịch sử");
      
      // Gọi callback để reload history
      if (onDelete) {
        onDelete(otpId);
      }
    } catch (error: any) {
      console.error("Error deleting OTP:", error);
      toast.error("Không thể xóa OTP. Vui lòng thử lại.");
    } finally {
      setDeletingId(null);
    }
  };

  // Filter các OTP chưa chuyển trạng thái (chưa bị khóa, chưa hết hạn)
  const allValidOtps = history.filter((otp) => {
    // Không hiển thị OTP đã bị khóa (failedAttemptsCount >= 3)
    if (otp.failedAttemptsCount !== undefined && otp.failedAttemptsCount >= 3) {
      return false;
    }
    // Không hiển thị OTP đã hết hạn
    if (otp.expiresAt && otp.expiresAt < currentTime) {
      return false;
    }
    return true;
  });

  // Chỉ lấy số lượng OTP cần hiển thị
  const validOtps = allValidOtps.slice(0, itemsToShow);
  const hasMore = allValidOtps.length > itemsToShow;

  return (
    <Card className="shadow-lg border-border/50 h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Clock className="w-5 h-5 text-accent" />
          </div>
          <CardTitle className="text-2xl">Lịch sử gửi OTP</CardTitle>
        </div>
        <CardDescription className="text-base">
          OTP vừa gửi
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-7 w-7 rounded" />
                      <Skeleton className="h-7 w-7 rounded" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : validOtps.length > 0 ? (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {validOtps.map((otp) => (
                <div key={otp.id} className="p-3 rounded-lg border bg-card">
                  {/* Header: Email, Time, Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {otp.email}
                          </p>
                          {otp.customerName && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Khách hàng: {otp.customerName}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(otp.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {otp.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                          <XCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {otp.status === "failed" && otp.errorCode ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-sm px-2 py-1 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                        >
                          {otp.errorCode}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="font-mono text-sm px-2 py-1 bg-muted/30"
                        >
                          {otp.otp}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyOtp(otp.status === "failed" && otp.errorCode ? otp.errorCode : otp.otp)}
                        className="h-7 w-7 p-0"
                        title={otp.status === "failed" && otp.errorCode ? "Sao chép error code" : "Sao chép OTP"}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {/* Chỉ hiển thị nút xóa nếu OTP chưa chuyển trạng thái */}
                      {!otp.hasNonPendingVerification ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                              title="Xóa OTP khỏi lịch sử"
                              disabled={deletingId === otp.id}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xác nhận xóa OTP</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc chắn muốn xóa OTP này khỏi lịch sử?
                                <br />
                                <span className="font-medium text-foreground mt-2 block">
                                  Email: {otp.email}
                                </span>
                                <span className="text-muted-foreground">
                                  OTP: {otp.otp}
                                </span>
                                <br />
                                <span className="text-xs text-muted-foreground mt-1 block">
                                  Lưu ý: Tất cả các xác thực và lần nhập sai liên quan cũng sẽ bị xóa.
                                </span>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(otp.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground opacity-50 cursor-not-allowed"
                          title="Không thể xóa OTP đã chuyển trạng thái"
                          disabled
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Thông tin chi tiết - Compact */}
                  <div className="space-y-1 text-xs">
                    {/* Hiển thị error reason khi OTP failed */}
                    {otp.status === "failed" && otp.errorReason && (
                      <div className="flex items-start gap-1.5">
                        <XCircle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-red-600 dark:text-red-400">
                          <span className="font-medium">Lỗi:</span> {otp.errorReason}
                        </p>
                      </div>
                    )}
                    {otp.expiresAt && otp.status === "success" && (
                      <div className="flex items-center gap-1.5">
                        <Clock className={`w-3 h-3 flex-shrink-0 ${
                          otp.expiresAt < currentTime
                            ? "text-red-500"
                            : "text-orange-500"
                        }`} />
                        <p className={`${
                          otp.expiresAt < currentTime
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : "text-orange-600 dark:text-orange-400 font-medium"
                        }`}>
                          {getTimeRemaining(otp.expiresAt)}
                        </p>
                      </div>
                    )}
                    {otp.lockedAt && otp.status === "success" && (
                      <div className="flex items-center gap-1.5">
                        <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                        <p className="text-red-600 dark:text-red-400">
                          <span className="font-medium">Khóa:</span> {formatDateTime(otp.lockedAt)}
                          {otp.failedAttemptsCount !== undefined && otp.failedAttemptsCount > 0 && ` (${otp.failedAttemptsCount} lần sai)`}
                        </p>
                      </div>
                    )}
                    {otp.failedAttemptsCount !== undefined && otp.failedAttemptsCount > 0 && !otp.lockedAt && otp.status === "success" && (
                      <div className="flex items-center gap-1.5">
                        <XCircle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                        <p className="text-orange-600 dark:text-orange-400">
                          <span className="font-medium">Nhập sai:</span> {otp.failedAttemptsCount}/3
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={() => setItemsToShow((prev) => prev + 3)}
                  className="w-full"
                >
                  Xem thêm ({allValidOtps.length - itemsToShow} OTP còn lại)
                </Button>
              </div>
            )}
            {itemsToShow > 3 && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  onClick={() => setItemsToShow(3)}
                  className="w-full text-xs"
                >
                  Thu gọn
                </Button>
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-base">Chưa có OTP nào được gửi</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
