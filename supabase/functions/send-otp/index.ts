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
  customerName?: string; // Tên khách hàng (tùy chọn)
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, customerName }: SendOtpRequest = await req.json();

    if (!email || !otp) {
      throw new Error("Email và OTP là bắt buộc");
    }

    // Format OTP không có khoảng trắng (giữ nguyên)
    const formattedOtp = otp;
    
    // Tên khách hàng hoặc mặc định
    const greeting = customerName ? `Chào Anh/Chị ${customerName},` : "Chào Anh/Chị,";

    // Send email using Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f1f5f9; padding: 20px;">
          <tr>
            <td align="center">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #60a5fa 0%, #a5f3fc 100%); padding: 20px 30px 18px 30px; text-align: center;">
                    <div style="margin-bottom: 12px;">
                      <img src="https://y99.vn/logo.png" alt="Y99 Logo" style="max-width: 85px; height: auto; display: inline-block;" />
                    </div>
                    <h1 style="color: #ffffff; margin: 0 0 4px 0; font-size: 24px; font-weight: 600; letter-spacing: 0.2px;">Xác thực Email</h1>
                    <p style="color: rgba(255, 255, 255, 0.95); margin: 0; font-size: 13px; font-weight: 400;">Doanh Nghiệp Tư Nhân Y99</p>
                  </td>
                </tr>
                
                <!-- Body Content -->
                <tr>
                  <td style="padding: 35px 30px; background-color: #ffffff;">
                    
                    <!-- OTP Section -->
                    <div style="text-align: center; margin-bottom: 30px;">
                      <p style="font-size: 22px; color: #1e293b; margin: 0 0 8px 0; font-weight: 700; letter-spacing: 0.5px;">Mã OTP: ${formattedOtp}</p>
                      <p style="font-size: 12px; color: #64748b; margin: 0;">(Lưu ý: Mã OTP chỉ có hiệu lực trong 30 phút)</p>
                    </div>
                    
                    <!-- Warning Box -->
                    <div style="background: #fffbeb; padding: 18px 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 0 0 24px 0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
                      <p style="font-size: 14px; color: #92400e; margin: 0; line-height: 1.6;">
                        <strong style="color: #78350f; font-size: 15px;">⚠️ Lưu ý quan trọng:</strong> Vui lòng không chia sẻ mã OTP này cho bất kỳ ai khác ngoại trừ Nhân viên của chúng tôi.
                      </p>
                    </div>
                    
                    <!-- Greeting -->
                    <p style="font-size: 15px; color: #1e293b; margin: 0 0 18px 0; line-height: 1.6;">
                      ${greeting}
                    </p>
                    
                    <!-- Main Content -->
                    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0; line-height: 1.7;">
                      Chúc mừng hồ sơ vay của Anh/Chị tại <strong style="color: #1e293b;">Doanh Nghiệp Tư Nhân Y99</strong> đã được phê duyệt.
                    </p>
                    
                    <p style="font-size: 15px; color: #334155; margin: 0 0 22px 0; line-height: 1.7;">
                      Để xác thực địa chỉ email (dùng để gửi Hợp đồng vay sau khi giải ngân), Anh/Chị vui lòng đọc mã OTP ở trên cho <strong style="color: #1e293b;">Nhân viên Chăm sóc Khách hàng (CSKH)</strong> đang hỗ trợ.
                    </p>
                    
                    <!-- Closing -->
                    <div>
                      <p style="font-size: 15px; color: #334155; margin: 0 0 4px 0;">Trân trọng,</p>
                      <p style="font-size: 15px; color: #1e293b; margin: 0; font-weight: 600;">Doanh Nghiệp Tư Nhân Y99</p>
                    </div>
                    
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px 35px; border-top: 2px solid #3b82f6;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="width: 110px; vertical-align: top; padding-right: 25px;">
                          <img src="https://y99.vn/logo.png" alt="Y99 Logo" style="max-width: 90px; height: auto; display: block;" />
                        </td>
                        <td style="vertical-align: top; border-left: 2px solid #cbd5e1; padding-left: 25px;">
                          <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: 700; color: #1e293b; letter-spacing: 0.3px;">DOANH NGHIỆP TƯ NHÂN Y99</p>
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.6;">
                                <strong style="color: #334155;">Điện thoại:</strong> 1900 575 792 | +84 292 38 999 33 (Nước ngoài)
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.6;">
                                <strong style="color: #334155;">Email:</strong> <a href="mailto:cskh@y99.vn" style="color: #3b82f6; text-decoration: none; font-weight: 500;">cskh@y99.vn</a>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.6;">
                                <strong style="color: #334155;">Website:</strong> <a href="https://y99.vn/" style="color: #3b82f6; text-decoration: none; font-weight: 500;">https://y99.vn/</a>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.6;">
                                <strong style="color: #334155;">Địa chỉ:</strong> 99B Nguyễn Trãi, Ninh Kiều, Cần Thơ
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Bộ phận Tài chính <finance@y99.vn>",
      to: [email],
      subject: "Xác thực Email - Mã OTP từ Doanh Nghiệp Tư Nhân Y99",
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
