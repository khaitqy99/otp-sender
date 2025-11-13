import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import type { OtpRecord } from "@/pages/Accountant";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OtpHistoryProps {
  history: OtpRecord[];
}

export const OtpHistory = ({ history }: OtpHistoryProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [itemsToShow, setItemsToShow] = useState(3); // Số OTP hiển thị ban đầu

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
        {validOtps.length > 0 ? (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {validOtps.map((otp) => (
                <div key={otp.id} className="p-3 rounded-lg border bg-card">
                  {/* Header: Email, Time, Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {otp.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(otp.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {otp.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
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

                  {/* Thông tin chi tiết - Compact */}
                  <div className="space-y-1 text-xs">
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
