import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resend webhook event types
interface ResendWebhookEvent {
  type: "email.sent" | "email.delivered" | "email.delivery_delayed" | "email.complained" | "email.bounced" | "email.opened" | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For bounce events
    bounce_type?: "hard" | "soft";
    bounce_subtype?: string;
    reason?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook signature (optional but recommended)
    // You can add signature verification here if Resend provides it
    
    const event: ResendWebhookEvent = await req.json();
    
    console.log("Received Resend webhook event:", event.type, event.data.email_id);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailId = event.data.email_id;
    const email = event.data.to[0]; // Lấy email đầu tiên trong danh sách

    // Tìm OTP record theo resend_email_id
    const { data: otpRecords, error: findError } = await supabase
      .from("otp_records")
      .select("*")
      .eq("resend_email_id", emailId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (findError) {
      console.error("Error finding OTP record:", findError);
      throw findError;
    }

    if (!otpRecords || otpRecords.length === 0) {
      console.warn(`No OTP record found for email_id: ${emailId}`);
      // Vẫn trả về success để Resend không retry
      return new Response(
        JSON.stringify({ received: true, message: "No matching record found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const otpRecord = otpRecords[0];
    let newStatus = otpRecord.status;
    let shouldUpdate = false;
    let errorCode: string | null = null;
    let errorReason: string | null = null;

    // Xử lý các loại events
    switch (event.type) {
      case "email.bounced":
        // Email bị bounce (không gửi được) - cập nhật status thành failed
        newStatus = "failed";
        shouldUpdate = true;
        
        // Lấy error code và reason từ bounce event
        // Resend có thể gửi error code trong nhiều format khác nhau
        errorCode = event.data.bounce_type || 
                   (event.data as any).error_code || 
                   (event.data as any).code || 
                   "BOUNCED";
        errorReason = event.data.reason || 
                     (event.data as any).error_message || 
                     (event.data as any).message || 
                     "Email bounced - recipient's mail server permanently rejected the email";
        
        console.log(`Email bounced for ${email}:`, { errorCode, errorReason });
        break;

      case "email.complained":
        // Email bị spam complaint - có thể coi như failed
        newStatus = "failed";
        shouldUpdate = true;
        errorCode = "COMPLAINED";
        errorReason = "Email marked as spam by recipient";
        console.log(`Email complained for ${email}`);
        break;

      case "email.delivered":
        // Email đã được gửi thành công - giữ nguyên status success
        console.log(`Email delivered successfully to ${email}`);
        // Không cần update vì đã là success
        break;

      case "email.sent":
        // Email đã được gửi (accepted by Resend) - giữ nguyên status
        console.log(`Email sent (accepted) to ${email}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Cập nhật status và error info nếu cần
    if (shouldUpdate && newStatus !== otpRecord.status) {
      const updateData: any = { status: newStatus };
      
      // Thêm error code và reason nếu có
      if (errorCode) {
        updateData.error_code = errorCode;
      }
      if (errorReason) {
        updateData.error_reason = errorReason;
      }

      const { error: updateError } = await supabase
        .from("otp_records")
        .update(updateData)
        .eq("id", otpRecord.id);

      if (updateError) {
        console.error("Error updating OTP record status:", updateError);
        throw updateError;
      }

      console.log(`Updated OTP record ${otpRecord.id} status from ${otpRecord.status} to ${newStatus}`, {
        errorCode,
        errorReason
      });
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        message: "Webhook processed successfully",
        event_type: event.type,
        updated: shouldUpdate
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing Resend webhook:", error);
    
    // Vẫn trả về 200 để Resend không retry quá nhiều
    // Nhưng log lỗi để debug
    return new Response(
      JSON.stringify({ 
        received: true, 
        error: error.message || "Error processing webhook",
        note: "Error logged but webhook acknowledged"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

