import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Send email using Resend
    const emailHtml = `
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

    const { data, error } = await resend.emails.send({
      from: "OTP System <noreply@y99.vn>",
      to: [email],
      subject: "Mã xác thực OTP của bạn",
      html: emailHtml,
    });

    if (error) {
      console.error("Resend API error:", error);
      throw new Error(`Không thể gửi email: ${error.message}`);
    }

    console.log(`OTP sent successfully to ${email}`, data);

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
