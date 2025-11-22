#!/bin/bash

# Test webhook với resend_email_id từ database
RESEND_EMAIL_ID="88c5d2c2-2924-4a7e-acaf-405d2dc75270"
EMAIL="test@nonexistent123.com"
PROJECT_ID="xeliuljgfwjygzdumzyv"
WEBHOOK_URL="https://${PROJECT_ID}.supabase.co/functions/v1/resend-webhook"

echo "Testing webhook với:"
echo "  Email ID: $RESEND_EMAIL_ID"
echo "  Email: $EMAIL"
echo "  URL: $WEBHOOK_URL"
echo ""

# Test với email.failed event
echo "Sending webhook request..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"email.failed\",
    \"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"email_id\": \"$RESEND_EMAIL_ID\",
      \"from\": \"finance@y99.vn\",
      \"to\": [\"$EMAIL\"],
      \"subject\": \"Xác thực Email - Mã OTP từ Doanh Nghiệp Tư Nhân Y99\",
      \"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"error\": {
        \"code\": \"550\",
        \"message\": \"The recipient's mail server permanently rejected the email.\"
      },
      \"reason\": \"The recipient's mail server permanently rejected the email.\"
    }
  }"

echo ""
echo ""
echo "✅ Webhook request đã được gửi!"
echo "📋 Bây giờ hãy:"
echo "   1. Kiểm tra logs trong Supabase Dashboard → Edge Functions → resend-webhook → Logs"
echo "   2. Chạy lại query SQL để xem status có được cập nhật thành 'failed' không"

