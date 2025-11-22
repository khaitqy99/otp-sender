import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resend webhook event types
interface ResendWebhookEvent {
  type: "email.sent" | "email.delivered" | "email.delivery_delayed" | "email.complained" | "email.bounced" | "email.failed" | "email.received" | "email.opened" | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For bounce/failed events
    bounce_type?: "hard" | "soft";
    bounce_subtype?: string;
    reason?: string;
    error?: {
      code?: string;
      message?: string;
    };
  };
}

serve(async (req) => {
  // Log mọi request ngay từ đầu
  console.log("=== WEBHOOK REQUEST RECEIVED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request - returning CORS headers");
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET request (webhook verification từ Resend)
  if (req.method === "GET") {
    console.log("GET request - likely webhook verification");
    return new Response(
      JSON.stringify({ message: "Webhook endpoint is active", timestamp: new Date().toISOString() }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // Chỉ xử lý POST requests
  if (req.method !== "POST") {
    console.log(`Unsupported method: ${req.method}`);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Log raw request để debug
    const rawBody = await req.text();
    console.log("Raw webhook body length:", rawBody.length);
    console.log("Raw webhook body:", rawBody);
    
    // Parse JSON - Resend có thể gửi array hoặc object
    let events: any[] = [];
    try {
      const parsed = JSON.parse(rawBody);
      // Resend có thể gửi array hoặc single object
      if (Array.isArray(parsed)) {
        events = parsed;
        console.log(`Received array of ${events.length} events`);
      } else {
        events = [parsed];
        console.log("Received single event object");
      }
    } catch (parseError: any) {
      console.error("Error parsing JSON:", parseError.message);
      console.error("Raw body that failed to parse:", rawBody.substring(0, 500));
      // Vẫn trả về 200 để Resend không retry
      return new Response(
        JSON.stringify({ received: true, error: "Invalid JSON", note: "Error logged" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Log parsed events
    console.log(`Processing ${events.length} event(s)`);
    events.forEach((event, index) => {
      console.log(`Event ${index + 1}:`, JSON.stringify(event, null, 2));
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase credentials not configured!");
      throw new Error("Supabase credentials not configured");
    }

    console.log("Supabase URL configured:", supabaseUrl ? "Yes" : "No");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Xử lý từng event
    const results: Array<{
      eventIndex: number;
      success: boolean;
      updated?: boolean;
      recordId?: number;
      eventType?: string;
      error?: string;
      message?: string;
    }> = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      console.log(`\n=== Processing event ${i + 1}/${events.length} ===`);
      
      try {
        // Lấy email_id - Resend có thể gửi trong nhiều format khác nhau
        const emailId = event.data?.email_id || 
                       event.data?.id || 
                       event.email_id || 
                       event.id ||
                       event.payload?.email_id ||
                       event.payload?.id;
        
        const email = event.data?.to?.[0] || 
                     event.data?.to || 
                     event.to?.[0] || 
                     event.to ||
                     event.payload?.to?.[0] ||
                     event.payload?.to;
        
        console.log(`Extracted email_id: ${emailId}`);
        console.log(`Extracted email: ${email}`);
        
        if (!emailId) {
          console.error(`Event ${i + 1}: No email_id found in event:`, JSON.stringify(event, null, 2));
          results.push({ eventIndex: i, success: false, error: "No email_id in event" });
          continue;
        }
        
        if (!email) {
          console.error(`Event ${i + 1}: No email found in event:`, JSON.stringify(event, null, 2));
          results.push({ eventIndex: i, success: false, error: "No email in event" });
          continue;
        }

        console.log(`Looking for OTP record with email_id: ${emailId}, email: ${email}`);

        // Tìm OTP record theo resend_email_id
        let { data: otpRecords, error: findError } = await supabase
          .from("otp_records")
          .select("*")
          .eq("resend_email_id", emailId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (findError) {
          console.error(`Event ${i + 1}: Error finding OTP record by resend_email_id:`, findError);
          results.push({ eventIndex: i, success: false, error: findError.message });
          continue;
        }

        console.log(`Found ${otpRecords?.length || 0} records by resend_email_id: ${emailId}`);

        // Fallback: Nếu không tìm thấy theo resend_email_id, thử tìm theo email và thời gian gần nhất (trong 2 giờ)
        if (!otpRecords || otpRecords.length === 0) {
          console.warn(`No OTP record found for email_id: ${emailId}, trying fallback search by email: ${email}`);
          
          // Tăng thời gian tìm kiếm lên 2 giờ để đảm bảo tìm thấy
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
          const { data: fallbackRecords, error: fallbackError } = await supabase
            .from("otp_records")
            .select("*")
            .eq("email", email)
            .gte("created_at", twoHoursAgo)
            .order("created_at", { ascending: false })
            .limit(5); // Lấy 5 records gần nhất để tìm đúng

          if (fallbackError) {
            console.error(`Event ${i + 1}: Error in fallback search:`, fallbackError);
            results.push({ eventIndex: i, success: false, error: fallbackError.message });
            continue;
          } else {
            console.log(`Found ${fallbackRecords?.length || 0} records via fallback search`);
            if (fallbackRecords && fallbackRecords.length > 0) {
              // Tìm record có resend_email_id null hoặc chưa được cập nhật
              const bestMatch = fallbackRecords.find(r => !r.resend_email_id || r.status === "success") || fallbackRecords[0];
              console.log(`Using best match: record ID ${bestMatch.id}, resend_email_id: ${bestMatch.resend_email_id}, status: ${bestMatch.status}`);
              otpRecords = [bestMatch];
              
              // Cập nhật resend_email_id nếu chưa có
              if (!bestMatch.resend_email_id) {
                console.log(`Updating resend_email_id for record ${bestMatch.id} to ${emailId}`);
                await supabase
                  .from("otp_records")
                  .update({ resend_email_id: emailId })
                  .eq("id", bestMatch.id);
              }
            }
          }
        }

        if (!otpRecords || otpRecords.length === 0) {
          console.warn(`Event ${i + 1}: No OTP record found for email_id: ${emailId} or email: ${email} (within 2 hours)`);
          results.push({ eventIndex: i, success: true, message: "No matching record found" });
          continue;
        }

        const otpRecord = otpRecords[0];
        let newStatus = otpRecord.status;
        let shouldUpdate = false;
        let errorCode: string | null = null;
        let errorReason: string | null = null;

        // Xử lý các loại events
        const eventType = event.type || event.event || event.name || event.event_type;
        console.log(`Event ${i + 1}: Processing event type: ${eventType}`);
    
        // Hàm dịch error message sang tiếng Việt
        const translateErrorToVietnamese = (errorCode: string, originalReason: string): string => {
          const errorCodeUpper = errorCode.toUpperCase();
          const reasonLower = originalReason.toLowerCase();
          
          // Dịch theo error code
          if (errorCodeUpper.includes("BOUNCED") || errorCodeUpper.includes("FAILED") || errorCodeUpper === "550") {
            if (reasonLower.includes("permanently rejected") || reasonLower.includes("permanently refused")) {
              return "Máy chủ email của người nhận đã từ chối email vĩnh viễn. Email không tồn tại hoặc địa chỉ email không hợp lệ.";
            }
            if (reasonLower.includes("mailbox full") || reasonLower.includes("quota exceeded")) {
              return "Hộp thư của người nhận đã đầy. Không thể gửi email.";
            }
            if (reasonLower.includes("user unknown") || reasonLower.includes("user not found")) {
              return "Người dùng không tồn tại. Địa chỉ email không hợp lệ.";
            }
            if (reasonLower.includes("domain") && reasonLower.includes("not found")) {
              return "Tên miền email không tồn tại. Địa chỉ email không hợp lệ.";
            }
            if (reasonLower.includes("rejected") || reasonLower.includes("refused")) {
              return "Máy chủ email của người nhận đã từ chối email. Vui lòng kiểm tra lại địa chỉ email.";
            }
            return "Email không thể gửi được. Máy chủ email của người nhận đã từ chối email.";
          }
          
          if (errorCodeUpper.includes("COMPLAINED") || reasonLower.includes("spam")) {
            return "Email đã bị đánh dấu là thư rác bởi người nhận.";
          }
          
          if (errorCodeUpper.includes("DELAYED") || reasonLower.includes("delayed")) {
            return "Gửi email bị trì hoãn. Hệ thống sẽ thử gửi lại sau.";
          }
          
          // Trả về message mặc định bằng tiếng Việt
          return "Email không thể gửi được. Vui lòng kiểm tra lại địa chỉ email.";
        };

        switch (eventType) {
          case "email.failed":
          case "email.bounced":
          case "bounced":
          case "email.bounce":
          case "failed":
            // Email bị bounce/failed (không gửi được) - cập nhật status thành failed
            newStatus = "failed";
            shouldUpdate = true;
            
            // Lấy error code và reason từ bounce/failed event
            // Resend có thể gửi error code trong nhiều format khác nhau
            const eventData = event.data || event.payload || event;
            const rawErrorCode = eventData.bounce_type || 
                       eventData.error_code || 
                       eventData.code || 
                       eventData.bounce_code ||
                       eventData.type ||
                       eventData.error?.code ||
                       "FAILED";
            const rawErrorReason = eventData.reason || 
                         eventData.error_message || 
                         eventData.message ||
                         eventData.bounce_message ||
                         eventData.description ||
                         eventData.error?.message ||
                         eventData.error ||
                         "Email failed - recipient's mail server permanently rejected the email";
            
            // Dịch sang tiếng Việt
            errorCode = rawErrorCode;
            errorReason = translateErrorToVietnamese(rawErrorCode, rawErrorReason);
            
            console.log(`Event ${i + 1}: Email failed/bounced for ${email}:`, { 
              eventType: eventType,
              errorCode, 
              errorReason,
              originalReason: rawErrorReason,
              fullEventData: JSON.stringify(eventData, null, 2)
            });
            break;

          case "email.complained":
          case "complained":
          case "email.complain":
            // Email bị spam complaint - có thể coi như failed
            newStatus = "failed";
            shouldUpdate = true;
            errorCode = "COMPLAINED";
            errorReason = "Email đã bị đánh dấu là thư rác bởi người nhận.";
            console.log(`Event ${i + 1}: Email complained for ${email}`);
            break;

          case "email.delivered":
          case "delivered":
            // Email đã được gửi thành công - giữ nguyên status success
            console.log(`Event ${i + 1}: Email delivered successfully to ${email}`);
            // Không cần update vì đã là success
            break;

          case "email.delivery_delayed":
          case "delivery_delayed":
            // Email bị delay - có thể coi như warning nhưng không update status
            console.log(`Event ${i + 1}: Email delivery delayed for ${email}`);
            // Không update status, chỉ log
            break;

          case "email.received":
          case "received":
            // Email đã được nhận - giữ nguyên status success
            console.log(`Event ${i + 1}: Email received for ${email}`);
            // Không cần update vì đã là success
            break;

          case "email.sent":
          case "sent":
            // Email đã được gửi (accepted by Resend) - giữ nguyên status
            console.log(`Event ${i + 1}: Email sent (accepted) to ${email}`);
            break;

          default:
            console.log(`Event ${i + 1}: Unhandled event type: ${eventType}, full event:`, JSON.stringify(event, null, 2));
        }

        // Cập nhật status và error info nếu cần
        // Luôn cập nhật nếu shouldUpdate = true, kể cả khi status đã là failed (để cập nhật error info)
        if (shouldUpdate) {
          const updateData: any = { status: newStatus };
          
          // Thêm error code và reason nếu có
          if (errorCode) {
            updateData.error_code = errorCode;
          }
          if (errorReason) {
            updateData.error_reason = errorReason;
          }

          console.log(`Event ${i + 1}: Updating OTP record ${otpRecord.id}:`, {
            currentStatus: otpRecord.status,
            newStatus: newStatus,
            updateData: updateData
          });

          const { error: updateError, data: updateResult } = await supabase
            .from("otp_records")
            .update(updateData)
            .eq("id", otpRecord.id)
            .select();

          if (updateError) {
            console.error(`Event ${i + 1}: Error updating OTP record status:`, updateError);
            results.push({ eventIndex: i, success: false, error: updateError.message });
            continue;
          }

          console.log(`Event ${i + 1}: Successfully updated OTP record ${otpRecord.id}`, {
            previousStatus: otpRecord.status,
            newStatus: newStatus,
            errorCode,
            errorReason,
            updatedRecord: updateResult
          });
          
          results.push({ 
            eventIndex: i, 
            success: true, 
            updated: true,
            recordId: otpRecord.id,
            eventType: eventType
          });
        } else {
          console.log(`Event ${i + 1}: No update needed for OTP record ${otpRecord.id}, status: ${otpRecord.status}, event: ${eventType}`);
          results.push({ 
            eventIndex: i, 
            success: true, 
            updated: false,
            eventType: eventType
          });
        }
      } catch (eventError: any) {
        console.error(`Event ${i + 1}: Error processing event:`, eventError);
        results.push({ 
          eventIndex: i, 
          success: false, 
          error: eventError.message || "Unknown error" 
        });
      }
    }

    console.log("\n=== WEBHOOK PROCESSING COMPLETE ===");
    console.log("Results:", JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({ 
        received: true, 
        message: "Webhook processed",
        eventsProcessed: events.length,
        results: results
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

