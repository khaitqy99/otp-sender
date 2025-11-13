import { useState } from "react";
import { OtpForm } from "@/components/OtpForm";
import { OtpHistory } from "@/components/OtpHistory";
import { Shield } from "lucide-react";

export interface OtpRecord {
  id: string;
  email: string;
  otp: string;
  timestamp: Date;
  status: "success" | "failed";
}

const Index = () => {
  const [otpHistory, setOtpHistory] = useState<OtpRecord[]>([]);

  const handleOtpSent = (record: OtpRecord) => {
    setOtpHistory((prev) => [record, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
          <div className="animate-in fade-in slide-in-from-left duration-700 delay-150">
            <OtpForm onOtpSent={handleOtpSent} />
          </div>

          {/* OTP History */}
          <div className="animate-in fade-in slide-in-from-right duration-700 delay-300">
            <OtpHistory history={otpHistory} />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center text-sm text-muted-foreground animate-in fade-in duration-700 delay-500">
          <p>🔒 Tất cả thông tin được mã hóa và bảo mật</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
