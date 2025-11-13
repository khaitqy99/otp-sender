import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import type { OtpRecord } from "@/pages/Index";
import { Button } from "@/components/ui/button";

interface OtpHistoryProps {
  history: OtpRecord[];
}

export const OtpHistory = ({ history }: OtpHistoryProps) => {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const copyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    toast.success("Đã sao chép OTP");
  };

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
          Danh sách các OTP đã gửi gần đây
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-base">Chưa có OTP nào được gửi</p>
            </div>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {record.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(record.timestamp)}
                    </p>
                  </div>
                  {record.status === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge
                    variant="outline"
                    className="font-mono text-sm px-3 py-1 bg-muted/50"
                  >
                    {record.otp}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyOtp(record.otp)}
                    className="h-7 px-2"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
