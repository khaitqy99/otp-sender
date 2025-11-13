import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to encode UTF-8 string to base64
function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const binary = Array.from(data, byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

interface SendOtpRequest {
  email: string;
  otp: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp }: SendOtpRequest = await req.json();

    if (!email || !otp) {
      throw new Error("Email và OTP là bắt buộc");
    }

    // Get Gmail credentials from environment
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Chưa cấu hình Gmail. Vui lòng thêm GMAIL_USER và GMAIL_APP_PASSWORD trong Secrets.");
    }

    // Send email using Gmail SMTP
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Mã xác thực OTP</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 10px; margin-top: 20px;">
          <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">Xin chào,</p>
          <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">Đây là mã OTP của bạn:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #3b82f6;">
            <span style="font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 8px; font-family: monospace;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #64748b; margin-top: 20px; text-align: center;">Mã này có hiệu lực trong 10 phút</p>
          <p style="font-size: 14px; color: #64748b; margin-top: 20px;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
          <p>© 2024 Hệ thống OTP. Tất cả quyền được bảo lưu.</p>
        </div>
      </div>
    `;

    // Create email message in RFC 2822 format
    const message = [
      `From: ${gmailUser}`,
      `To: ${email}`,
      `Subject: =?UTF-8?B?${utf8ToBase64("Mã xác thực OTP của bạn")}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      utf8ToBase64(emailBody),
    ].join("\r\n");

    // Send via Gmail API
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmailAppPassword}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: btoa(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gmail API error:", response.status, errorText);
      throw new Error(`Không thể gửi email: ${response.status} - ${errorText}`);
    }

    console.log(`OTP sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "OTP đã được gửi thành công" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Đã xảy ra lỗi khi gửi OTP" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
